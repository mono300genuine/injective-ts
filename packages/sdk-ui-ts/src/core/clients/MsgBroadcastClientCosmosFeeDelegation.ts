import {
  createTxRawFromSigResponse,
  IndexerGrpcTransactionApi,
} from '@injectivelabs/sdk-ts'
import {
  isCosmosWallet,
  CosmosWalletSignTransactionArgs,
} from '@injectivelabs/wallet-ts'
import {
  MsgBroadcastOptions,
  MsgBroadcastTxOptions,
  MsgBroadcastTxOptionsWithAddresses,
} from './types'
import {
  getEthereumSignerAddress,
  getGasPriceBasedOnMessage,
  getInjectiveSignerAddress,
} from './utils'
import type { DirectSignResponse } from '@cosmjs/proto-signing'

export class MsgBroadcastClientCosmosFeeDelegation {
  public options: MsgBroadcastOptions

  public transactionApi: IndexerGrpcTransactionApi

  constructor(options: MsgBroadcastOptions) {
    this.options = options
    this.transactionApi = new IndexerGrpcTransactionApi(
      options.endpoints.indexerApi,
    )
  }

  async broadcast(tx: MsgBroadcastTxOptions) {
    const { options } = this
    const { walletStrategy } = options
    const txWithAddresses = {
      ...tx,
      ethereumAddress: getEthereumSignerAddress(
        tx.injectiveAddress || tx.address,
      ),
      injectiveAddress: getInjectiveSignerAddress(
        tx.injectiveAddress || tx.address,
      ),
    } as MsgBroadcastTxOptionsWithAddresses

    return isCosmosWallet(walletStrategy.wallet)
      ? this.broadcastCosmos(txWithAddresses)
      : this.broadcastWeb3(txWithAddresses)
  }

  private async broadcastWeb3(tx: MsgBroadcastTxOptionsWithAddresses) {
    const { options, transactionApi } = this
    const { walletStrategy, ethereumChainId, metricsProvider } = options
    const msgs = Array.isArray(tx.msgs) ? tx.msgs : [tx.msgs]
    const web3Msgs = msgs.map((msg) => msg.toWeb3())

    const prepareTx = async () => {
      const promise = transactionApi.prepareTxRequest({
        memo: tx.memo,
        message: web3Msgs,
        address: tx.ethereumAddress,
        chainId: ethereumChainId,
        gasLimit: getGasPriceBasedOnMessage(msgs),
        estimateGas: false,
      })

      if (!metricsProvider) {
        return await promise
      }

      return await metricsProvider.sendAndRecordWithoutProbability(
        promise,
        `${tx.bucket}PrepareTx`,
      )
    }

    const signTx = async (txData: any) => {
      const promise = walletStrategy.signTransaction(txData, tx.ethereumAddress)

      if (!metricsProvider) {
        return await promise
      }

      return await metricsProvider.sendAndRecordWithoutProbability(
        promise,
        `${tx.bucket}SignTx`,
      )
    }

    const txResponse = await prepareTx()
    const signature = (await signTx(txResponse.getData())) as string

    const promise = transactionApi.broadcastTxRequest({
      signature,
      txResponse,
      message: web3Msgs,
      chainId: ethereumChainId,
    })

    if (!metricsProvider) {
      const { txHash } = await promise

      return txHash
    }

    const { txHash } = await metricsProvider.sendAndRecordWithoutProbability(
      promise,
      `${tx.bucket}BroadcastTx`,
    )

    return txHash
  }

  private async broadcastCosmos(tx: MsgBroadcastTxOptionsWithAddresses) {
    const { options, transactionApi } = this
    const { walletStrategy, chainId, ethereumChainId, metricsProvider } =
      options
    const msgs = Array.isArray(tx.msgs) ? tx.msgs : [tx.msgs]
    const web3Msgs = msgs.map((msg) => msg.toWeb3())

    const prepareTx = async () => {
      const promise = transactionApi.prepareTxRequest({
        memo: tx.memo,
        message: web3Msgs,
        address: tx.ethereumAddress,
        chainId: ethereumChainId,
        gasLimit: getGasPriceBasedOnMessage(msgs),
        estimateGas: false,
      })

      if (!metricsProvider) {
        return await promise
      }

      return await metricsProvider.sendAndRecordWithoutProbability(
        promise,
        `${tx.bucket}PrepareTx`,
      )
    }

    const txResponse = await prepareTx()
    const transaction = {
      message: msgs,
      memo: tx.memo || '',
      gas: (tx.gasLimit || getGasPriceBasedOnMessage(msgs)).toString(),
      feePayer: txResponse.getFeePayer(),
    } as CosmosWalletSignTransactionArgs

    const directSignResponse = (await walletStrategy.signTransaction(
      transaction,
      tx.injectiveAddress,
    )) as DirectSignResponse

    const txRaw = createTxRawFromSigResponse(directSignResponse)
    txRaw.setSignaturesList([
      txResponse.getFeePayerSig(),
      directSignResponse.signature.signature,
    ])

    return await walletStrategy.sendTransaction(txRaw, {
      chainId,
      address: tx.injectiveAddress,
    })
  }
}
