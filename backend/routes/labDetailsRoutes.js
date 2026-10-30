
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const router = express.Router();

const UNIVERSITY_LABS_URL =
  'https://www.eng.ruh.ac.lk/deie/research/labs/';


router.get('/:id', async (req, res) => {
  try {
  
const labSections = {
  1: 'tab-1399904645-1-94',
  2: 'tab-1408632650589-1-0',
  3: 'tab-1408632652419-2-4',
  4: 'tab-1408632653300-3-2',
  5: 'tab-1408632654204-4-4',
6: 'tab-1408634537320-5-0'
};


    const sectionId = labSections[req.params.id];

    if (!sectionId) {
      return res.status(404).json({
        message: 'Laboratory not found'
      });
    }

    const response = await axios.get(UNIVERSITY_LABS_URL, {
      timeout: 15000
    });

    const $ = cheerio.load(response.data);

    const section = $(`#${sectionId}`);

    if (!section.length) {
      return res.status(404).json({
        message: 'Official laboratory details not found'
      });
    }

    res.json({
      id: Number(req.params.id),

name: $('a[href="#' + sectionId + '"]').first().text().trim(),
      html: section.html(),
      source: UNIVERSITY_LABS_URL
    });

  } catch (error) {
    console.error('Laboratory details error:', error.message);

    res.status(500).json({
      message: 'Unable to retrieve laboratory details'
    });
  }
});


module.exports = router;
