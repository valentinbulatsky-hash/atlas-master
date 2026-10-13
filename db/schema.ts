import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const entities = sqliteTable('entities', {
 id:text('id').primaryKey(), ownerId:text('owner_id').notNull(), campaignId:text('campaign_id'), folderId:text('folder_id'),
 kind:text('kind').notNull(), title:text('title').notNull(), summary:text('summary').notNull().default(''),
 payload:text('payload').notNull().default('{}'), revision:integer('revision').notNull().default(1),
 createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull()
},t=>[index('entities_owner').on(t.ownerId),index('entities_campaign').on(t.ownerId,t.campaignId)]);
export const assets = sqliteTable('assets', {id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),key:text('key').notNull(),mime:text('mime').notNull(),size:integer('size').notNull(),createdAt:text('created_at').notNull()});
