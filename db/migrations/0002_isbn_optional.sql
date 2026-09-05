-- Some older/gift albums in real collections predate ISBNs or never had one
-- catalogued. Making isbn optional to allow importing them.
alter table albums alter column isbn drop not null;
