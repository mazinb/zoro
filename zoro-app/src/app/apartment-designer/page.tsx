'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Room {
  id: string;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  color: string;
}

interface Furniture {
  id: string;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
}

export default function ApartmentDesigner() {
  const [rooms, setRooms] = useState<Room[]>([
    { id: '1', name: 'Living Room', width: 200, height: 150, x: 50, y: 50, color: '#E8F4F8' },
  ]);
  const [furniture, setFurniture] = useState<Furniture[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedFurniture, setSelectedFurniture] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const furnitureTemplates = [
    { name: 'Sofa', width: 80, height: 40, color: '#8B7355' },
    { name: 'Bed', width: 60, height: 80, color: '#A0826D' },
    { name: 'Table', width: 50, height: 50, color: '#D4A574' },
    { name: 'Chair', width: 25, height: 25, color: '#B8956A' },
    { name: 'Desk', width: 60, height: 30, color: '#C19A6B' },
    { name: 'Bookshelf', width: 40, height: 20, color: '#8B4513' },
  ];

  const roomColors = [
    '#E8F4F8', '#FFF8DC', '#F5F5DC', '#E6E6FA',
    '#FFE4E1', '#F0FFF0', '#FFF5EE', '#F5F5F5'
  ];

  const addRoom = () => {
    const newRoom: Room = {
      id: Date.now().toString(),
      name: `Room ${rooms.length + 1}`,
      width: 150,
      height: 120,
      x: 100 + rooms.length * 20,
      y: 100 + rooms.length * 20,
      color: roomColors[rooms.length % roomColors.length],
    };
    setRooms([...rooms, newRoom]);
  };

  const addFurniture = (template: typeof furnitureTemplates[0]) => {
    const newFurniture: Furniture = {
      id: Date.now().toString(),
      name: template.name,
      width: template.width,
      height: template.height,
      x: 150,
      y: 150,
      color: template.color,
      rotation: 0,
    };
    setFurniture([...furniture, newFurniture]);
  };

  const deleteSelected = () => {
    if (selectedRoom) {
      setRooms(rooms.filter(r => r.id !== selectedRoom));
      setSelectedRoom(null);
    }
    if (selectedFurniture) {
      setFurniture(furniture.filter(f => f.id !== selectedFurniture));
      setSelectedFurniture(null);
    }
  };

  const rotateFurniture = () => {
    if (selectedFurniture) {
      setFurniture(furniture.map(f => 
        f.id === selectedFurniture ? { ...f, rotation: (f.rotation + 90) % 360 } : f
      ));
    }
  };

  const updateRoomSize = (id: string, dimension: 'width' | 'height', value: number) => {
    setRooms(rooms.map(r => 
      r.id === id ? { ...r, [dimension]: Math.max(50, value) } : r
    ));
  };

  const updateRoomName = (id: string, name: string) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, name } : r));
  };

  const updateRoomColor = (id: string, color: string) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, color } : r));
  };

  const exportDesign = () => {
    const design = { rooms, furniture };
    const dataStr = JSON.stringify(design, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'apartment-design.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    if (confirm('Clear all rooms and furniture?')) {
      setRooms([]);
      setFurniture([]);
      setSelectedRoom(null);
      setSelectedFurniture(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, type: 'room' | 'furniture', id: string) => {
    e.stopPropagation();
    setIsDragging(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    if (type === 'room') {
      setSelectedRoom(id);
      setSelectedFurniture(null);
    } else {
      setSelectedFurniture(id);
      setSelectedRoom(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    const deltaX = currentX - dragStart.x;
    const deltaY = currentY - dragStart.y;

    if (selectedRoom) {
      setRooms(rooms.map(r => 
        r.id === selectedRoom ? { ...r, x: r.x + deltaX, y: r.y + deltaY } : r
      ));
    }
    if (selectedFurniture) {
      setFurniture(furniture.map(f => 
        f.id === selectedFurniture ? { ...f, x: f.x + deltaX, y: f.y + deltaY } : f
      ));
    }
    setDragStart({ x: currentX, y: currentY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Apartment Designer</h1>
          <p className="text-gray-600">Design your dream apartment layout with rooms and furniture</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Rooms</h2>
              <button
                onClick={addRoom}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded mb-4 transition-colors"
              >
                + Add Room
              </button>
              <div className="space-y-2">
                {rooms.map(room => (
                  <div
                    key={room.id}
                    className={`p-3 rounded cursor-pointer transition-colors ${
                      selectedRoom === room.id ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50 border border-gray-200'
                    }`}
                    onClick={() => { setSelectedRoom(room.id); setSelectedFurniture(null); }}
                  >
                    <div className="font-medium text-sm">{room.name}</div>
                    <div className="text-xs text-gray-500">{room.width} × {room.height}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Furniture</h2>
              <div className="space-y-2">
                {furnitureTemplates.map((template, idx) => (
                  <button
                    key={idx}
                    onClick={() => addFurniture(template)}
                    className="w-full text-left bg-gray-50 hover:bg-gray-100 border border-gray-200 py-2 px-3 rounded transition-colors"
                  >
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="text-xs text-gray-500">{template.width} × {template.height}</div>
                  </button>
                ))}
              </div>
            </div>

            {selectedRoom && (
              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Room Properties</h2>
                {rooms.filter(r => r.id === selectedRoom).map(room => (
                  <div key={room.id} className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={room.name}
                        onChange={(e) => updateRoomName(room.id, e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
                      <input
                        type="number"
                        value={room.width}
                        onChange={(e) => updateRoomSize(room.id, 'width', parseInt(e.target.value))}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                      <input
                        type="number"
                        value={room.height}
                        onChange={(e) => updateRoomSize(room.id, 'height', parseInt(e.target.value))}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                      <div className="flex flex-wrap gap-2">
                        {roomColors.map(color => (
                          <button
                            key={color}
                            onClick={() => updateRoomColor(room.id, color)}
                            className={`w-8 h-8 rounded border-2 ${room.color === color ? 'border-blue-500' : 'border-gray-300'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Canvas</h2>
                <div className="flex gap-2">
                  {selectedFurniture && (
                    <button
                      onClick={rotateFurniture}
                      className="bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded transition-colors text-sm"
                    >
                      Rotate
                    </button>
                  )}
                  {(selectedRoom || selectedFurniture) && (
                    <button
                      onClick={deleteSelected}
                      className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded transition-colors text-sm"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    onClick={exportDesign}
                    className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded transition-colors text-sm"
                  >
                    Export
                  </button>
                  <button
                    onClick={clearAll}
                    className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded transition-colors text-sm"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div
                ref={canvasRef}
                className="relative border-2 border-gray-300 rounded bg-white overflow-hidden"
                style={{ width: '100%', height: '600px' }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {rooms.map(room => (
                  <div
                    key={room.id}
                    className={`absolute border-2 cursor-move ${
                      selectedRoom === room.id ? 'border-blue-500' : 'border-gray-400'
                    }`}
                    style={{
                      left: `${room.x}px`,
                      top: `${room.y}px`,
                      width: `${room.width}px`,
                      height: `${room.height}px`,
                      backgroundColor: room.color,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, 'room', room.id)}
                  >
                    <div className="absolute top-1 left-1 bg-white bg-opacity-75 px-2 py-1 rounded text-xs font-medium">
                      {room.name}
                    </div>
                  </div>
                ))}
                {furniture.map(item => (
                  <div
                    key={item.id}
                    className={`absolute border-2 cursor-move flex items-center justify-center ${
                      selectedFurniture === item.id ? 'border-purple-500' : 'border-gray-600'
                    }`}
                    style={{
                      left: `${item.x}px`,
                      top: `${item.y}px`,
                      width: `${item.width}px`,
                      height: `${item.height}px`,
                      backgroundColor: item.color,
                      transform: `rotate(${item.rotation}deg)`,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, 'furniture', item.id)}
                  >
                    <div className="text-white text-xs font-bold text-center px-1">
                      {item.name}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-sm text-gray-600">
                <p><strong>Instructions:</strong></p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>Click "Add Room" to create new rooms</li>
                  <li>Click furniture items to add them to your design</li>
                  <li>Drag rooms and furniture to reposition them</li>
                  <li>Select items to edit properties or delete them</li>
                  <li>Use "Rotate" to change furniture orientation</li>
                  <li>Export your design as JSON for later use</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
