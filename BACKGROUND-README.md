# MSWD Portal - Background Management System

## Overview
This project now has a unified background image system that makes it easy to manage background images across all pages and sections. Instead of hardcoding backgrounds in multiple places, you can now change them by updating the `<img>` tags in your HTML file.

## How It Works

### HTML Image Tags (Simple Method)
The background images are now actual `<img>` elements in your HTML. To change the background across all pages:

1. Open `landingpage.html`
2. Find the `<img>` tags with class `section-bg-image`
3. Change the `src` attribute to your desired image
4. Save the file and refresh your browser

### Example of Current Setup
```html
<!-- Home section background -->
<section id="home" class="hero-section global-background">
  <img src="pictures/building1.jpg" alt="Background image" class="section-bg-image" />
  <!-- content -->
</section>

<!-- Services section background -->
<section id="services" class="info-section global-background">
  <img src="pictures/building1.jpg" alt="Background image" class="section-bg-image" />
  <!-- content -->
</section>
```

### Available Background Options
- **Office Building**: `pictures/building1.jpg`
- **MSWD Logo**: `pictures/logo1.png`
- **Municipality Logo**: `pictures/logo2.jpg`
- **Professional Stock Photo**: `https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?q=80&w=1600&auto=format&fit=crop`

## Footer Logo Configuration

### Current Footer Logo Setup
The footer now uses proper `<img>` tags instead of placeholder text:

```html
<div class="footer-logos">
  <img src="pictures/logo1.png" alt="MSWD Logo" class="footer-logo">
  <img src="pictures/logo2.jpg" alt="Municipality Logo" class="footer-logo">
</div>
```

### How to Change Footer Logos
1. **Replace logo images**: Update the `src` attributes in the footer section
2. **Add/remove logos**: Add or remove `<img>` tags as needed
3. **Customize styling**: Modify the `.footer-logo` CSS class in `landingpage.css`

### Footer Logo Features
- **Responsive layout**: Horizontal on desktop, vertical on mobile
- **Hover effects**: Subtle scale and brightness on hover
- **Flexible sizing**: Automatically adjusts for different screen sizes
- **Easy customization**: Simple to change images and styling

## File Structure

```
landpage_Capstone/
├── background-config.css      # Background configuration and effects
├── landingpage.css           # Main styles (now uses img-based backgrounds)
├── landingpage.html          # HTML with img background elements
└── BACKGROUND-README.md      # This file
```

## Adding New Backgrounds

### Method 1: Update HTML
Simply change the `src` attribute in your HTML:
```html
<!-- Change from building to logo -->
<img src="pictures/logo1.png" alt="Background image" class="section-bg-image" />

<!-- Change to custom image -->
<img src="pictures/your-new-image.jpg" alt="Background image" class="section-bg-image" />
```

### Method 2: Add New Sections
Add the background image to any new section:
```html
<section class="global-background">
  <img src="pictures/building1.jpg" alt="Background image" class="section-bg-image" />
  <h2>New Section</h2>
  <p>This section will automatically use the background image.</p>
</section>
```

## Section-Specific Backgrounds

Each section can have different background images by changing the `src` attribute:

```html
<!-- Home section with building background -->
<img src="pictures/building1.jpg" alt="Background image" class="section-bg-image" />

<!-- Services section with logo background -->
<img src="pictures/logo1.png" alt="Background image" class="section-bg-image" />

<!-- About section with different image -->
<img src="pictures/logo2.jpg" alt="Background image" class="section-bg-image" />
```

## CSS Classes Used

- `.global-background` - Applied to sections that should have backgrounds
- `.section-bg-image` - Applied to background image elements
- `.section-blur-bg` - Legacy class (now works with img system)
- `.footer-logos` - Container for footer logo images
- `.footer-logo` - Individual footer logo styling

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Standard HTML img elements
- CSS positioning and filters

## Troubleshooting

### Background Not Showing
1. Check that the image path is correct
2. Verify the `section-bg-image` class is applied
3. Make sure the image file exists in the specified location

### Background Too Strong/Weak
1. Adjust the `opacity` value in `landingpage.css`
2. Values range from 0.0 (invisible) to 1.0 (fully visible)

### Background Too Blurry/Sharp
1. Adjust the `filter: blur()` value in `landingpage.css`
2. Values like `0px` (sharp) to `5px` (very blurry)

### Footer Logos Not Displaying
1. Check that the image paths are correct
2. Verify the `footer-logo` class is applied
3. Make sure the image files exist in the specified location

## Quick Start

1. **Change background image**: Edit the `src` attribute in HTML
2. **Change footer logos**: Edit the `src` attributes in the footer section
3. **Add new sections**: Add `global-background` class and img element
4. **Customize effects**: Modify opacity and blur values in CSS

## Example Usage

```html
<!-- Any new section automatically gets the background image -->
<section class="global-background">
  <img src="pictures/building1.jpg" alt="Background image" class="section-bg-image" />
  <h2>New Section</h2>
  <p>This section will automatically use the background image.</p>
</section>

<!-- Sections without global-background class keep their original styling -->
<section class="impact-section">
  <h2>Our Impact</h2>
  <p>This section keeps its original blue background.</p>
</section>

<!-- Footer with custom logos -->
<div class="footer-logos">
  <img src="pictures/your-logo1.png" alt="Your Logo" class="footer-logo">
  <img src="pictures/your-logo2.png" alt="Partner Logo" class="footer-logo">
</div>
```

## Current Setup

- **Home section**: Uses `pictures/building1.jpg` as background
- **Services section**: Uses `pictures/building1.jpg` as background  
- **About section**: Uses `pictures/building1.jpg` as background
- **Our Impact section**: Keeps original blue background (no background image)
- **Footer logos**: Uses `pictures/logo1.png` and `pictures/logo2.jpg`

## Quick Background Changes

To change all backgrounds at once, use find and replace in your HTML editor:

**Find:** `src="pictures/building1.jpg"`
**Replace with:** `src="pictures/logo1.png"`

## Quick Footer Logo Changes

To change footer logos, update the src attributes:

```html
<!-- Change MSWD logo -->
<img src="pictures/your-mswd-logo.png" alt="MSWD Logo" class="footer-logo">

<!-- Change municipality logo -->
<img src="pictures/your-municipality-logo.png" alt="Municipality Logo" class="footer-logo">
```

The background system is now using simple HTML img tags - easy to manage and change anytime! 🎉
