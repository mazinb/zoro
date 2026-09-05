# Apartment Designer Tool

An interactive web-based tool for uploading floor plan images and measuring distances with precision. Perfect for apartment planning, renovation projects, and space analysis.

## Features

### Image Upload
- **Drag & Drop**: Drop floor plan images directly onto the canvas
- **File Upload**: Choose images from your device
- **Supported Formats**: All standard image formats (PNG, JPG, PDF screenshots, etc.)

### Measurement Tools
- **Distance Measurement**: Click two points to measure distances
- **Real-world Scale**: Calibrate pixel-to-real-world ratio
- **Multiple Units**: Support for feet (ft), meters (m), and centimeters (cm)
- **Visual Indicators**: Red lines with distance labels overlay the floor plan
- **Multiple Measurements**: Add unlimited measurements to your floor plan

### Annotation System
- **Text Annotations**: Click to add notes and labels anywhere on the plan
- **Color Coding**: Customize annotation colors
- **Delete/Edit**: Manage all annotations easily

### Canvas Controls
- **Pan/Move Tool**: Drag the image to reposition it
- **Zoom Control**: Slider for 50% to 300% zoom
- **Interactive Canvas**: Smooth, responsive interaction with the floor plan

### Scale Calibration
- **Custom Calibration**: Set how many real-world units equal 100 pixels
- **Unit Selection**: Choose between feet, meters, or centimeters
- **Accurate Measurements**: All distances automatically calculated based on calibration

### Export Options
- **JSON Export**: Save all measurements and annotations as structured data
- **PNG Export**: Download an annotated image with all measurements visible
- **Data Persistence**: Reload your work later (import feature coming soon)

## Usage

1. **Upload Your Floor Plan**:
   - Click "Choose Image" or drag/drop an image onto the canvas
   - Your floor plan will appear on the canvas

2. **Calibrate the Scale**:
   - Set "100 pixels = X units" based on a known dimension in your floor plan
   - Choose your preferred unit (ft, m, or cm)
   - Example: If 100 pixels = 10 feet on your plan, enter "10" and select "ft"

3. **Measure Distances**:
   - Select the "Measure Distance" tool
   - Click on your starting point
   - Click on your ending point
   - The distance will be calculated and displayed

4. **Add Annotations**:
   - Select the "Add Annotation" tool
   - Click where you want to place a note
   - Enter your text in the prompt
   - The annotation appears on the floor plan

5. **Navigate the Canvas**:
   - Use the "Pan/Move" tool to drag the image around
   - Adjust the zoom slider to see fine details
   - Click measurements in the sidebar to highlight them

6. **Export Your Work**:
   - Click "Export Data (JSON)" to save measurements and annotations
   - Click "Export Image (PNG)" to download the annotated floor plan

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

## Use Cases

- **Apartment Shopping**: Measure rooms to see if your furniture will fit
- **Renovation Planning**: Calculate wall lengths, room dimensions, and material needs
- **Interior Design**: Plan furniture placement with accurate measurements
- **Real Estate**: Annotate floor plans for clients or documentation
- **Space Planning**: Analyze room sizes and proportions

## Pro Tips

- **Calibration is Key**: Use a known dimension (like a standard door width of 3ft/36in) to calibrate accurately
- **Multiple References**: Take measurements from multiple known dimensions to verify accuracy
- **Label Everything**: Use annotations to mark room names, furniture locations, and special features
- **Compare Plans**: Upload different floor plan options to compare measurements side-by-side

## Future Enhancements

- Import saved JSON designs
- Area calculation (square footage)
- Angle measurements
- Shape drawing tools (circles, rectangles)
- Furniture templates overlay
- PDF direct upload
- Multiple floor plan comparison
- Undo/Redo functionality
- Sharing via URL
- Collaborative editing

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

Part of the Zoro project - MIT License
