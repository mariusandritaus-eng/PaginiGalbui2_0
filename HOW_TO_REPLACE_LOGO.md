# How to Replace the DCCO Logo

## Current Logo Location

The DCCO logo is stored in two places:
1. **Source**: `/app/dcco-logo.png` (backup copy)
2. **Used by frontend**: `/app/frontend/public/dcco-logo.png`

## To Replace the Logo

### Option 1: Direct Replacement
```bash
# Replace the file in the public folder
cp /path/to/your/new-logo.png /app/frontend/public/dcco-logo.png

# Also update the backup
cp /path/to/your/new-logo.png /app/dcco-logo.png
```

### Option 2: Use a Different Filename
If you want to use a different filename:

1. Copy your new logo to `/app/frontend/public/your-logo-name.png`
2. Update `/app/frontend/src/LandingPage.js`:
   - Find: `src="/dcco-logo.png"`
   - Replace with: `src="/your-logo-name.png"`

## Logo Specifications

**Current Settings**:
- Size: `h-32` (128px height)
- Position: Bottom right with `pr-8` (padding-right: 2rem)
- Format: PNG (1.2MB)

**To Adjust Size**:
Edit `/app/frontend/src/LandingPage.js` and change `className="h-32"`:
- `h-24` = 96px (smaller)
- `h-28` = 112px
- `h-32` = 128px (current)
- `h-36` = 144px
- `h-40` = 160px (bigger)

**To Change Position**:
Edit `/app/frontend/src/LandingPage.js`:
- Bottom right (current): `justify-end pr-8`
- Bottom center: `justify-center`
- Bottom left: `justify-start pl-8`

## Notes

- The logo is served from `/app/frontend/public/` folder
- Frontend has hot reload, so changes appear automatically
- Supported formats: PNG, JPG, SVG, WEBP
- Recommended: Keep file size under 2MB for fast loading
