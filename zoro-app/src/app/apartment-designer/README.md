# Apartment Designer Tool

An interactive web-based tool for uploading floor plan images and measuring distances with precision. Perfect for apartment planning, renovation projects, and space analysis.

## Features

### Image Upload
- **Drag & Drop**: Drop floor plan images directly onto the canvas
- **File Upload**: Choose images from your device
- **Supported Formats**: All standard image formats (PNG, JPG, PDF screenshots, etc.)
- **Opacity Control**: Adjust floor plan transparency to see your changes clearly

### Apartment Combining Tools
- **Draw New Walls** (Green): Click two points to add new walls for creating rooms like a study
- **Mark Walls to Remove** (Red): Click two points to mark existing walls you plan to remove
- **Define Room Areas**: Click corners to outline rooms, SHIFT+click to finish and calculate square footage
- **Automatic Area Calculation**: Rooms show square footage based on your calibration

### Measurement Tools
- **Distance Measurement**: Click two points to measure distances
- **Real-world Scale**: Calibrate pixel-to-real-world ratio
- **Multiple Units**: Support for feet (ft), meters (m), and centimeters (cm)
- **Visual Indicators**: Measurement lines with distance labels
- **Multiple Measurements**: Add unlimited measurements

### Annotation & Labeling
- **Text Labels**: Click to add notes and room labels anywhere
- **Room Naming**: Name rooms when defining areas (e.g., "Study", "Master Bedroom")
- **Delete/Edit**: Manage all annotations and elements easily

### Canvas Controls
- **Pan/Move Tool**: Drag the image to reposition it
- **Zoom Control**: Slider for 50% to 300% zoom
- **Opacity Slider**: Make floor plan transparent to see your changes
- **Interactive Canvas**: Smooth, responsive interaction

### Export Options
- **JSON Export**: Save all measurements, walls, and room definitions
- **PNG Export**: Download an annotated image with all changes visible
- **Complete Redesign Data**: All wall changes and room configurations saved

## Usage

### For Combining Two Apartments:

1. **Upload Your Floor Plan**:
   - Get a floor plan showing both 2-bedroom apartments
   - Click "Choose Image" or drag/drop onto the canvas

2. **Calibrate the Scale**:
   - Set "100 pixels = X units" based on a known dimension (e.g., door width)
   - Choose your unit (ft, m, or cm)
   - Example: If 100 pixels = 10 feet, enter "10" and select "ft"

3. **Mark Walls to Remove**:
   - Select "🔨 Mark Wall to Remove" (red tool)
   - Click start point of wall to remove
   - Click end point - a red dashed line marks the wall for removal
   - This shows which walls you'll knock down to combine the spaces

4. **Draw New Walls**:
   - Select "🧱 Draw New Wall" (green tool)
   - Click where the new wall starts
   - Click where it ends
   - Green solid lines show new walls (e.g., to create a study)

5. **Define Room Areas**:
   - Select "📐 Define Room Area"
   - Click corners of the room in order
   - Hold SHIFT and click to finish the room shape
   - Enter room name (e.g., "Study", "Master Bedroom", "Living Room")
   - Area is calculated and displayed automatically

6. **Measure & Verify**:
   - Use "📏 Measure Distance" to check dimensions
   - Verify furniture will fit in new room configurations
   - Measure doorways, hallways, etc.

7. **Adjust Visibility**:
   - Lower "Floor Plan Opacity" slider to see your changes more clearly
   - Use zoom for detailed work
   - Pan to navigate large floor plans

8. **Export Your Redesign**:
   - Click "Export Data (JSON)" to save all wall changes and room definitions
   - Click "Export Image (PNG)" to download the redesign as an image
   - Share with contractors, designers, or for your records

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

- **Combining Apartments**: Plan how to merge two units into one larger space
- **Adding Rooms**: Convert spare bedrooms into home offices, studies, or nurseries
- **Renovation Planning**: Visualize wall removal and construction
- **Interior Design**: Plan furniture placement with accurate measurements
- **Real Estate Development**: Show investors apartment combination possibilities
- **Space Reconfiguration**: Experiment with different layouts before committing

## Pro Tips for Apartment Combining

- **Start with Scale**: Always calibrate first using a known dimension (door widths are usually 3ft/36in)
- **Mark Before Drawing**: First mark all walls to remove, then draw new walls - easier to visualize
- **Load-Bearing Walls**: Mark walls that might be load-bearing with labels - consult an engineer!
- **Check Doorways**: Measure new doorway locations to ensure code compliance (typically 32-36")
- **Room Minimums**: Most bedrooms need 70 sq ft minimum, studies can be smaller
- **Lower Opacity**: Set floor plan to 50-70% opacity to see your changes clearly
- **Save Progress**: Export JSON frequently so you can compare different design iterations
- **Multiple Versions**: Try different configurations - removing different walls creates different layouts

## Example: Two 2-Beds → One 2-Bed + Study

**Starting Point**: Two adjacent 2-bedroom apartments (800 sq ft each)

**Goal**: Create one 2-bedroom + study apartment (1,600 sq ft total)

**Steps**:
1. Upload combined floor plan
2. Mark shared wall between apartments for removal (red dashed line)
3. Remove internal walls from one apartment to create open living space
4. Add new wall to convert small bedroom into study (green line)
5. Define areas: Master Bedroom, Second Bedroom, Study, Kitchen, Living Room
6. Measure to verify furniture fit
7. Export final design

**Result**: Spacious 2-bed with dedicated home office!

## Future Enhancements

- Import saved JSON designs to continue editing
- 3D wall height considerations
- Structural/load-bearing wall warnings
- Furniture templates to drag onto floor plan
- Cost estimation for wall removal/construction
- Before/after side-by-side comparison
- PDF direct upload
- Undo/Redo functionality
- Sharing via URL

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

Part of the Zoro project - MIT License
