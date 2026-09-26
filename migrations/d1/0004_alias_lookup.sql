-- Detail URLs resolve aliases once, then seek coffees by primary key.
CREATE INDEX IF NOT EXISTS aliases_lookup ON coffee_aliases(alias_type,alias,coffee_id);
