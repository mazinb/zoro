# Apartment Designer Tool

An interactive web-based apartment layout designer that allows users to create custom floor plans with rooms and furniture.

## Features

### Room Management
- **Add Rooms**: Create multiple rooms with customizable dimensions
- **Room Customization**: 
  - Edit room names
  - Adjust width and height
  - Choose from 8 color schemes
- **Drag & Drop**: Reposition rooms on the canvas by dragging

### Furniture Placement
- **Furniture Library**: Pre-built furniture items including:
  - Sofa
  - Bed
  - Table
  - Chair
  - Desk
  - Bookshelf
- **Furniture Controls**:
  - Drag furniture to desired locations
  - Rotate furniture in 90° increments
  - Delete unwanted items

### Canvas Features
- **Interactive Canvas**: 600px height with full-width responsive design
- **Visual Selection**: Selected items are highlighted with colored borders
- **Real-time Updates**: Instant visual feedback for all changes

### Data Management
- **Export Design**: Save your apartment layout as JSON
- **Clear All**: Reset the entire design with confirmation
- **Properties Panel**: Edit selected room properties in real-time

## Usage

1. **Start Designing**:
   - Click "Add Room" to create your first room
   - Customize the room name, size, and color in the properties panel

2. **Add Furniture**:
   - Click any furniture item from the left sidebar
   - The item will appear on the canvas
   - Drag it to the desired position

3. **Customize**:
   - Click any room or furniture item to select it
   - Use the properties panel to adjust room dimensions and colors
   - Rotate furniture using the "Rotate" button

4. **Save Your Work**:
   - Click "Export" to download your design as JSON
   - Import this file later to continue editing (import feature coming soon)

## Technical Details

- **Framework**: Next.js 14+ with App Router
- **Styling**: Tailwind CSS
- **State Management**: React hooks (useState, useRef)
- **Drag & Drop**: Custom implementation with mouse events
- **File Format**: JSON export for design persistence

## URL

Access the tool at: `https://getzoro.com/apartment-designer`

## Design Constraints

- Minimum room dimensions: 50px × 50px
- Canvas size: 100% width × 600px height
- All positions and sizes are in pixels
- Rotation angles: 0°, 90°, 180°, 270°

## Future Enhancements

- Import saved designs
- Room connection/doorways
- Measurement tools (real-world dimensions)
- 3D view toggle
- Furniture scaling
- Custom furniture creation
- Share designs via URL
- Print/PDF export
- Snap-to-grid functionality
- Undo/Redo functionality

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

Part of the Zoro project - MIT License
