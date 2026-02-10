# Rad Dad Band Website

A stunning single-page website for Rad Dad, a pop punk cover band.

## Features

- **Modern Design**: State-of-the-art UI with smooth animations and gradients
- **Responsive**: Works perfectly on all devices (desktop, tablet, mobile)
- **Interactive Elements**: Hover effects, animations, and smooth transitions
- **Video Embed**: YouTube video integration
- **Social Links**: Direct links to Facebook and Instagram
- **Contact Information**: Email and phone number with clickable links

## Setup

1. Place your logo file (`RadDad_Logo.jpg`) in the root directory
2. Open `index.html` in a web browser
3. That's it! No build process required.

## File Structure

```
RadDad Website/
├── index.html          # Main HTML file
├── styles.css          # All styling and animations
├── script.js           # Interactive JavaScript features
├── RadDad_Logo.jpg     # Your band logo (add this file)
└── README.md           # This file
```

## Customization

### Adding More Videos

To add more videos, you can modify the video section in `index.html`. The current setup uses a single video, but you can easily add more by duplicating the video-wrapper structure.

### Adding Artwork Images

If you want to incorporate the additional artwork images from Travis's promotions, you can:

1. Add them to the `decoration` elements in the HTML
2. Use them as background images in CSS
3. Create a gallery section (though the current design keeps it minimal)

### Changing Colors

Edit the CSS variables in `styles.css`:

```css
:root {
    --primary-color: #ff006e;
    --secondary-color: #8338ec;
    --accent-color: #3a86ff;
    /* ... */
}
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Notes

- The logo should be named `RadDad_Logo.jpg` and placed in the root directory
- The YouTube video uses a clickable thumbnail that opens on YouTube (starts at 14 seconds)
- All links open in new tabs for better user experience
- The design is optimized for a single-page experience with no scrolling required
