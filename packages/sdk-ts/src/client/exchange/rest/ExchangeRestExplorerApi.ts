import BaseRestConsumer from '../../BaseRestConsumer'
import {
  ExplorerApiResponse,
  BlockFromExplorerApiResponse,
  BlockWithTxs,
  TransactionFromExplorerApiResponse,
  Transaction,
} from '../types/explorer-rest'
import {
  BlockNotFoundException,
  TransactionNotFoundException,
  HttpException,
} from '@injectivelabs/exceptions'
import { DEFAULT_PAGINATION_TOTAL_COUNT } from '../../../utils/constants'
import { ExchangeRestExplorerTransformer } from '../transformers'
import { Block } from '../types/explorer'

export class ExchangeRestExplorerApi extends BaseRestConsumer {
  async fetchBlock(blockHashHeight: string): Promise<BlockWithTxs> {
    try {
      const response = (await this.client.get(
        `blocks/${blockHashHeight}`,
      )) as ExplorerApiResponse<BlockFromExplorerApiResponse>

      return ExchangeRestExplorerTransformer.blockWithTxToBlockWithTx(
        response.data.data,
      )
    } catch (error: any) {
      if (error.response.status === 404) {
        throw new BlockNotFoundException(error.message)
      } else {
        throw new HttpException(error.message)
      }
    }
  }

  async fetchBlocks(params?: { limit?: number }): Promise<Block[]> {
    try {
      const { limit } = params || { limit: 50 }
      const response = (await this.client.get('blocks', {
        limit,
      })) as ExplorerApiResponse<BlockFromExplorerApiResponse[]>

      return ExchangeRestExplorerTransformer.blocksToBlocks(response.data.data)
    } catch (error) {
      throw new HttpException((error as any).message)
    }
  }

  async fetchBlocksWithTx(params?: {
    before?: number
    limit?: number
  }): Promise<{ total: number; blocks: BlockWithTxs[] }> {
    try {
      const { before, limit } = params || { limit: 50 }
      const response = (await this.client.get('blocks', {
        limit,
        before,
      })) as ExplorerApiResponse<BlockFromExplorerApiResponse[]>

      const { paging, data } = response.data

      return {
        total: paging.total > 0 ? paging.total : DEFAULT_PAGINATION_TOTAL_COUNT,
        blocks: data
          ? ExchangeRestExplorerTransformer.blocksWithTxsToBlocksWithTxs(data)
          : [],
      }
    } catch (error: any) {
      throw new HttpException(error.message)
    }
  }

  async fetchTransactions(params?: {
    before?: number
    limit?: number
    skip?: number
  }): Promise<{ total: number; transactions: Transaction[] }> {
    try {
      const { before, limit, skip } = params || { limit: 50 }
      const response = (await this.client.get('txs', {
        before,
        limit,
        skip,
      })) as ExplorerApiResponse<TransactionFromExplorerApiResponse[]>

      const { paging, data } = response.data

      return {
        total: paging.total > 0 ? paging.total : DEFAULT_PAGINATION_TOTAL_COUNT,
        transactions: data
          ? ExchangeRestExplorerTransformer.transactionsToTransactions(data)
          : [],
      }
    } catch (error: any) {
      throw new HttpException(error.message)
    }
  }

  async fetchAccountTransactions({
    account,
    before,
    limit,
    skip,
  }: {
    account: string
    before?: number
    limit?: number
    skip?: number
  }): Promise<{ total: number; transactions: Transaction[] }> {
    try {
      const response = (await this.client.get(`accountTxs/${account}`, {
        before,
        limit,
        skip,
      })) as ExplorerApiResponse<TransactionFromExplorerApiResponse[]>
      const { paging, data } = response.data

      return {
        total: paging.total > 0 ? paging.total : DEFAULT_PAGINATION_TOTAL_COUNT,
        transactions: data
          ? ExchangeRestExplorerTransformer.transactionsToTransactions(data)
          : [],
      }
    } catch (error: any) {
      throw new HttpException(error.message)
    }
  }

  async fetchTransaction(hash: string): Promise<Transaction> {
    try {
      const response = (await this.client.get(
        `txs/${hash}`,
      )) as ExplorerApiResponse<TransactionFromExplorerApiResponse>

      return ExchangeRestExplorerTransformer.transactionToTransaction(
        response.data.data,
      )
    } catch (error: any) {
      if (error.response.status === 404) {
        throw new TransactionNotFoundException(error.message)
      } else {
        throw new HttpException(error.message)
      }
    }
  }
}