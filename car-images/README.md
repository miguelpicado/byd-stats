# BYD Stats — Car Images

Car images used by the BYD Stats app, served via GitHub raw CDN.

## URL pattern

```
https://raw.githubusercontent.com/miguelpicado/byd-stats/main/car-images/{Model-Slug}/{color-id}.webp
```

Example:
```
https://raw.githubusercontent.com/miguelpicado/byd-stats/main/car-images/BYD-Seal/black.webp
```

## Folder structure

```
car-images/
├── BYD-Seal/
│   ├── black.webp
│   ├── lavender.webp
│   ├── grey.webp
│   ├── white.webp
│   ├── atlantis.webp
│   └── red.webp
├── BYD-Dolphin/          # pending images
├── BYD-Dolphin-Surf/     # pending images
├── BYD-Seal-U/           # pending images
├── BYD-Sealion-7/        # pending images
├── BYD-Tang/             # pending images
├── BYD-Atto-2/           # pending images
└── BYD-Atto-3/           # pending images
```

## Image specs

- Format: WebP
- Dimensions: 800px wide max (transparent background PNG source)
- Target size: < 150 KB per image
- Naming: `{color-id}.webp` — must match color IDs defined in `src/core/carCatalog.ts`

## Adding a new model

1. Create folder `car-images/{Model-Slug}/`
2. Add one WebP per color: `{color-id}.webp`
3. Add the model entry to `src/core/carCatalog.ts` in BYD-Stats-Premium with matching slug and color IDs
