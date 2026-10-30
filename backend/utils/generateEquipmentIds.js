
const EquipmentItem = require('../models/EquipmentItem');

// Generate individual equipment IDs.
// Example: OSC-001, OSC-002, OSC-003

const generateEquipmentIds = async (
  equipmentId,
  code,
  quantity
) => {
  const cleanCode = code.trim().toUpperCase();

  if (!/^[A-Z]{2,6}$/.test(cleanCode)) {
    throw new Error('Invalid equipment code');
  }

  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error('Invalid equipment quantity');
  }

  // Find existing items for this equipment
  const existingItems = await EquipmentItem.find({
    equipment: equipmentId
  });

  const existingCount = existingItems.length;

  // Only generate missing items
  const itemsToCreate = quantity - existingCount;

  if (itemsToCreate <= 0) {
    return [];
  }

  // Find the highest number already used by this code
  const usedIds = await EquipmentItem.find({
    equipmentId: {
      $regex: `^${cleanCode}-[0-9]+$`
    }
  }).select('equipmentId');

  let highestNumber = 0;

  usedIds.forEach((item) => {
    const number = Number(item.equipmentId.split('-')[1]);

    if (number > highestNumber) {
      highestNumber = number;
    }
  });

  const newItems = [];

  for (let i = 1; i <= itemsToCreate; i++) {
    const nextNumber = highestNumber + i;

    const newId =
      `${cleanCode}-${String(nextNumber).padStart(3, '0')}`;

    newItems.push({
      equipment: equipmentId,
      equipmentId: newId,
      status: 'Available'
    });
  }

  return await EquipmentItem.insertMany(newItems);
};

module.exports = generateEquipmentIds;
