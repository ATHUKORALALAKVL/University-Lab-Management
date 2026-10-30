
const axios = require('axios');
const cheerio = require('cheerio');

async function testWebsite() {
  try {
    const url = 'https://www.eng.ruh.ac.lk/deie/research/labs/';

    const response = await axios.get(url, {
      timeout: 15000
    });

    const $ = cheerio.load(response.data);

    console.log('Website connected successfully!');
    console.log('Page title:', $('title').text().trim());

    

const labLinks = [
  'Power Systems and High Voltage Laboratory',
  'Electric Machines and Power Electronics Laboratory',
  'Electronics and Measurement Laboratory',
  'Communication and Systems Engineering Laboratory',
  'Information Engineering Laboratory',
  '24 x 7 Undergraduate Development Project Laboratory'
];

console.log('\nChecking all six laboratories:');

$('a[href^="#tab-"]').each((index, element) => {
  const name = $(element).text().trim();

  if (labLinks.includes(name)) {
    const sectionId = $(element).attr('href');
    const section = $(sectionId);

    console.log('\nLaboratory:', name);
    console.log('Section found:', section.length > 0);
    console.log('Text length:', section.text().trim().length);
    console.log('Images found:', section.find('img').length);
  }
});


    console.log('\nHeadings found:');

   
console.log('\nLaboratory names found:');

const lab6Link = $('a[href^="#tab-"]').filter((index, element) =>
  $(element).text().includes('Undergraduate Development Project Laboratory')
).first();

console.log('\nLAB 6 CORRECT SECTION ID:');
console.log(lab6Link.attr('href'));

const lab6Section = $(lab6Link.attr('href'));
console.log('Section found:', lab6Section.length > 0);

$('body *').each((index, element) => {
  const $element = $(element);

  // Check elements containing only their own text
  const text = $element
    .clone()
    .children()
    .remove()
    .end()
    .text()
    .trim();

  if (
    text.length > 5 &&
    text.length < 150 &&
    /Laboratory$/i.test(text) &&
!text.includes("Computing Laboratory") &&
!text.includes("Computer Engineering Laboratories")
  ) {
   
if (element.tagName === 'a') {
  console.log(
    text,
    '| Link:',
    $element.attr('href')
  );
}

  }
});


  } catch (error) {
    console.error('Website connection failed:', error.message);
  }
}

testWebsite();
