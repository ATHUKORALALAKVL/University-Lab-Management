
require('dotenv').config();

const mongoose = require('mongoose');
const Lab = require('../models/Lab');

const labs = [
  {
    name: "Power System and High Voltage Lab",
    description: "Laboratory for power systems and high voltage experiments.",
    location: "DEIE Laboratory Building",
    capacity: 30,
    isAvailable: true
  },
  {
    name: "Electrical Machines and Power Electronics Lab",
    description: "Laboratory for electrical machines and power electronics practicals.",
    location: "DEIE Laboratory Building",
    capacity: 30,
    isAvailable: true
  },
  {
    name: "Electronic and Measurement Lab",
    description: "Laboratory for electronics and electrical measurement experiments.",
    location: "DEIE Laboratory Building",
    capacity: 25,
    isAvailable: true
  },
  {
    name: "Communication and Systems Engineering Lab",
    description: "Laboratory for communication and control systems experiments.",
    location: "DEIE Laboratory Building",
    capacity: 25,
    isAvailable: true
  },
  {
    name: "Computer and Networking Lab",
    description: "Laboratory for computer programming and networking practicals.",
    location: "DEIE Laboratory Building",
    capacity: 30,
    isAvailable: true
  },
  {
    name: "Undergraduate Project Lab",
    description: "Laboratory for undergraduate engineering projects.",
    location: "DEIE Laboratory Building",
    capacity: 20,
    isAvailable: true
  }
];

const seedLabs = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log('MongoDB connected successfully!');

    await Lab.insertMany(labs);

    console.log('Six laboratories added successfully!');

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error seeding laboratories:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedLabs();
