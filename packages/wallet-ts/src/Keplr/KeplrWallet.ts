import type { Keplr, Window as KeplrWindow } from '@keplr-wallet/types'
import type { OfflineDirectSigner } from '@cosmjs/proto-signing'
import { BroadcastMode } from '@cosmjs/launchpad'
import type { TxRaw } from '@injectivelabs/chain-api/cosmos/tx/v1beta1/tx_pb'
import {
  ChainId,
  CosmosChainId,
  TestnetCosmosChainId,
} from '@injectivelabs/ts-types'
import { TxRestClient } from '@injectivelabs/sdk-ts/dist/core/transaction'
import { getExperimentalChainConfigBasedOnChainId } from './utils'
import { getEndpointsFromChainId } from '../cosmos/endpoints'

const $window = (window || {}) as KeplrWindow

export class KeplrWallet {
  private chainId: CosmosChainId | TestnetCosmosChainId | ChainId

  constructor(chainId: CosmosChainId | TestnetCosmosChainId | ChainId) {
    this.chainId = chainId
  }

  static async experimentalSuggestChainWithChainData(chainData: any) {
    if (!window) {
      throw new Error('Please install Keplr extension')
    }

    if (!window.keplr) {
      throw new Error('Please install Keplr extension')
    }

    try {
      await window.keplr.experimentalSuggestChain(chainData)
    } catch (e: any) {
      throw new Error(e.message)
    }
  }

  async getKeplrWallet() {
    const { chainId } = this

    if (!$window) {
      throw new Error('Please install Keplr extension')
    }

    if (!$window.keplr) {
      throw new Error('Please install Keplr extension')
    }

    try {
      await $window.keplr.enable(chainId)

      return $window.keplr as Keplr
    } catch (e: any) {
      throw new Error(e.message)
    }
  }

  async experimentalSuggestChain() {
    const { chainId } = this

    if (!$window) {
      throw new Error('Please install Keplr extension')
    }

    if (!$window.keplr) {
      throw new Error('Please install Keplr extension')
    }

    const chainData = getExperimentalChainConfigBasedOnChainId(chainId)

    if (!chainData) {
      throw new Error(`There is no data for ${chainId}`)
    }

    try {
      await $window.keplr.experimentalSuggestChain(chainData)
    } catch (e: any) {
      throw new Error(e.message)
    }
  }

  async getAccounts() {
    const { chainId } = this

    if (!$window) {
      throw new Error('Please install Keplr extension')
    }

    if (!$window.keplr) {
      throw new Error('Please install Keplr extension')
    }

    if (!$window.keplr.getOfflineSigner) {
      throw new Error('Please install Keplr extension')
    }

    try {
      return $window.keplr.getOfflineSigner(chainId).getAccounts()
    } catch (e: any) {
      throw new Error(e.message)
    }
  }

  async getKey(): Promise<{
    name: string
    algo: string
    pubKey: Uint8Array
    address: Uint8Array
    bech32Address: string
  }> {
    const keplr = await this.getKeplrWallet()

    try {
      return keplr.getKey(this.chainId)
    } catch (e: any) {
      throw new Error(e.message)
    }
  }

  async getOfflineSigner(): Promise<OfflineDirectSigner> {
    const { chainId } = this
    const keplr = await this.getKeplrWallet()

    try {
      return keplr.getOfflineSigner(chainId) as unknown as OfflineDirectSigner
    } catch (e: any) {
      throw new Error(e.message)
    }
  }

  /**
   * This method is used to broadcast a transaction to the network.
   * Since it uses the `Sync` mode, it will not wait for the transaction to be included in a block,
   * so we have to make sure the transaction is included in a block after its broadcasted
   *
   * @param txRaw - raw transaction to broadcast
   * @returns tx hash
   */
  async broadcastTx(txRaw: TxRaw): Promise<string> {
    const { chainId } = this
    const keplr = await this.getKeplrWallet()
    const txHashBuff = await keplr.sendTx(
      chainId,
      txRaw.serializeBinary(),
      BroadcastMode.Sync,
    )

    if (!txHashBuff) {
      throw new Error('Transaction failed to be broadcasted')
    }

    return Buffer.from(txHashBuff).toString('hex')
  }

  /**
   * This method is used to broadcast a transaction to the network.
   * Since it uses the `Block` mode, and it will wait for the transaction to be included in a block,
   *
   * @param txRaw - raw transaction to broadcast
   * @returns tx hash
   */
  async broadcastTxBlock(txRaw: TxRaw): Promise<string> {
    const { chainId } = this
    const keplr = await this.getKeplrWallet()
    const result = await keplr.sendTx(
      chainId,
      txRaw.serializeBinary(),
      BroadcastMode.Block,
    )

    if (!result) {
      throw new Error('Transaction failed to be broadcasted')
    }

    return Buffer.from(result).toString('hex')
  }

  async waitTxBroadcasted(txHash: string): Promise<string> {
    const endpoints = await this.getChainEndpoints()
    const txClient = new TxRestClient(endpoints.rest)
    const result = await txClient.fetchTxPoll(txHash)

    return result.txhash
  }

  async getChainEndpoints(): Promise<{ rpc: string; rest: string }> {
    const { chainId } = this

    try {
      return getEndpointsFromChainId(chainId)
    } catch (e: any) {
      throw new Error(e.message)
    }
  }

  public async checkChainIdSupport() {
    const { chainId } = this

    if (!$window) {
      throw new Error('Please install Keplr extension')
    }

    if (!$window.keplr) {
      throw new Error('Please install Keplr extension')
    }

    try {
      await $window.keplr.getKey(chainId)

      // Chain exists already on Keplr
      return true
    } catch (e) {
      return false
    }
  }
}
