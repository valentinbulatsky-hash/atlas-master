ALTER TABLE entities ADD COLUMN name_key TEXT;
ALTER TABLE entities ADD COLUMN material_type TEXT;
CREATE INDEX entities_names ON entities(owner_id,campaign_id,folder_id,material_type,name_key);
