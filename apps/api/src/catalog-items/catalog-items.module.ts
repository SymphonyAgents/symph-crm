import { Module } from '@nestjs/common'
import { CatalogItemsController } from './catalog-items.controller'
import { CatalogItemsService } from './catalog-items.service'
import { StorageModule } from '../storage/storage.module'

@Module({
  imports: [StorageModule],
  controllers: [CatalogItemsController],
  providers: [CatalogItemsService],
  exports: [CatalogItemsService],
})
export class CatalogItemsModule {}
