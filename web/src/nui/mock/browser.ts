import type { MockHandler } from './index';
import { ok } from './index';

// Browser mock for `browser:sites` (server/computers/browser.lua): the network exactly as the
// server sends it for the config that ships (configs/shared/browser.lua) - addresses normalised,
// every block as { type, ... } - plus one `url` site at the end, which the shipped config only has
// as a commented-out example, so the framed path can be seen in dev. Change a page there, change
// it here.

const sites = [
  {
    address: 'city.gov',
    title: 'City Services',
    bookmark: true,
    blocks: [
      { type: 'heading', text: 'City Services' },
      {
        type: 'text',
        text: 'The front desk of City Hall, without the queue. Find out what the city can do for you, what to bring with you, and where to go next.',
      },
      {
        type: 'notice',
        kind: 'info',
        title: 'Before you visit',
        text: 'Nothing can be paid or handed in through this site. Bring your paperwork to the counter in person.',
      },
      { type: 'subheading', text: 'What we help with' },
      {
        type: 'list',
        items: [
          'Identity cards and replacement documents',
          'Driving licences and vehicle registration',
          'Business permits and trading licences',
          'Fines, invoices and payment plans',
          'Complaints, compliments and public records',
        ],
      },
      { type: 'subheading', text: 'Opening hours' },
      {
        type: 'facts',
        rows: [
          { label: 'Counter service', value: 'Every day, 8:00 to 18:00' },
          { label: 'Licensing desk', value: 'Monday to Friday, 9:00 to 16:00' },
          { label: 'Records office', value: 'By appointment' },
          { label: 'Where to find us', value: 'City Hall, main entrance' },
        ],
      },
      { type: 'subheading', text: 'More from the city' },
      {
        type: 'links',
        items: [
          { to: 'city.gov/permits', label: 'Permits and licences', note: 'What each application needs, and how long it takes' },
          { to: 'jobs.city.gov', label: 'Job Centre', note: 'Open vacancies and how to apply' },
          { to: 'emergency.gov', label: 'Emergency guide', note: 'Who to call, and what to tell them' },
        ],
      },
    ],
  },
  {
    address: 'city.gov/permits',
    title: 'Permits and Licences',
    bookmark: false,
    blocks: [
      { type: 'heading', text: 'Permits and licences' },
      {
        type: 'text',
        text: 'Most applications are decided at the counter on the day. Bring the right documents the first time and you will not need to come back.',
      },
      { type: 'subheading', text: 'What to bring' },
      {
        type: 'facts',
        rows: [
          { label: 'Identity card', value: 'Proof of your name and date of birth' },
          { label: 'Driving licence', value: 'A valid identity card and a passed driving test' },
          { label: 'Vehicle registration', value: 'Proof of ownership and a valid driving licence' },
          { label: 'Business permit', value: 'An identity card, the address of the premises and a short description of the trade' },
          { label: 'Firearms licence', value: 'An identity card and a clean record; decided by the police, not at the counter' },
        ],
      },
      { type: 'subheading', text: 'Good to know' },
      {
        type: 'list',
        items: [
          'A permit belongs to the person named on it. It cannot be lent or sold.',
          'Tell the licensing desk if your business moves or changes hands.',
          'A lost document is replaced at the counter for a small fee.',
        ],
      },
      {
        type: 'notice',
        kind: 'warning',
        title: 'Stay on the right side of it',
        text: 'Trading without a permit, or driving without a licence, can cost you a fine and the right to apply again.',
      },
    ],
  },
  {
    address: 'jobs.city.gov',
    title: 'Job Centre',
    bookmark: true,
    blocks: [
      { type: 'heading', text: 'Job Centre' },
      {
        type: 'text',
        text: 'Looking for work, or looking for workers? Start here. The Job Centre keeps the list of who is hiring and helps you take the first step.',
      },
      { type: 'subheading', text: 'Work you can start this week' },
      {
        type: 'text',
        text: 'These jobs need no experience. Most ask only for an identity card, and a driving licence if there is a vehicle involved.',
      },
      {
        type: 'list',
        items: [
          'Delivery and courier driving',
          'Taxi and private hire',
          'Refuse and recycling collection',
          'Vehicle recovery and towing',
          'Warehouse and dock work',
        ],
      },
      { type: 'subheading', text: 'How to apply' },
      {
        type: 'list',
        items: [
          'Ask at the Job Centre counter for the current list of vacancies.',
          'Pick the job that suits you and sign on. Bring your identity card.',
          'Collect your work vehicle or uniform where the job starts.',
          'You are paid for the work you finish, so there is no harm in trying a few.',
        ],
      },
      {
        type: 'notice',
        kind: 'success',
        title: 'Public services are hiring',
        text: 'The police, the ambulance service and the city\'s mechanics take applications all year. Ask at their front desk for a form.',
      },
      { type: 'subheading', text: 'For employers' },
      {
        type: 'text',
        text: 'Running a business? You hire, promote and let go of your staff yourself, from the Business Manager on your work computer. The Job Centre can put up a notice for you: speak to the counter.',
      },
      {
        type: 'links',
        items: [{ to: 'city.gov/permits', label: 'Permits and licences', note: 'The documents most jobs ask for' }, { to: 'city.gov' }],
      },
    ],
  },
  {
    address: 'network.help',
    title: 'How This Network Works',
    bookmark: true,
    blocks: [
      { type: 'heading', text: 'How this network works' },
      {
        type: 'text',
        text: 'This computer is connected to the city network. It is smaller than you might expect: only sites that have been set up on the network can be opened, and nothing here leads outside it.',
      },
      { type: 'subheading', text: 'Opening a site' },
      {
        type: 'list',
        items: [
          'Type its address in the bar at the top, such as city.gov, and press Enter.',
          'Or pick a bookmark from the row underneath.',
          'Or search by name on the start page. Typing home in the address bar takes you there.',
        ],
      },
      { type: 'subheading', text: 'Finding your way around' },
      {
        type: 'facts',
        rows: [
          { label: 'Back and Forward', value: 'Step through the pages you have visited in this tab' },
          { label: 'Reload', value: 'Load the page again' },
          { label: 'Home', value: 'Go to the page a new tab opens on' },
          { label: 'Tabs', value: 'Keep several pages open at once. The plus button opens another' },
        ],
      },
      { type: 'subheading', text: 'When a site can\'t be reached' },
      {
        type: 'text',
        text: 'That message means the address is not on this network. Check the spelling first. Addresses from anywhere else will not work, however well you remember them.',
      },
      {
        type: 'notice',
        kind: 'warning',
        title: 'On a shared computer',
        text: 'Other people use this computer after you, and anyone standing behind you can read the screen. Sign out of your accounts before you walk away.',
      },
      { type: 'links', items: [{ to: 'city.gov' }, { to: 'jobs.city.gov' }, { to: 'emergency.gov' }] },
    ],
  },
  {
    address: 'emergency.gov',
    title: 'Emergency Guide',
    bookmark: true,
    blocks: [
      { type: 'heading', text: 'Emergency guide' },
      {
        type: 'notice',
        kind: 'error',
        title: 'In danger right now?',
        text: 'Do not report it here. Call the emergency services from your phone, or shout for help.',
      },
      { type: 'subheading', text: 'When to call' },
      {
        type: 'list',
        items: [
          'Someone is badly hurt, unconscious or not breathing.',
          'A crime is happening now, or someone is in danger.',
          'A fire, a serious crash, or anything else that could hurt more people.',
        ],
      },
      { type: 'subheading', text: 'What to tell them' },
      {
        type: 'facts',
        rows: [
          { label: 'Where', value: 'The street, and a landmark or business close by' },
          { label: 'What', value: 'What happened, in one sentence' },
          { label: 'Who', value: 'How many people are involved, and how many are hurt' },
          { label: 'You', value: 'Your name, and whether you are safe where you are' },
        ],
      },
      { type: 'subheading', text: 'While you wait' },
      {
        type: 'list',
        items: [
          'Stay on the line until you are told you can hang up.',
          'Get yourself to safety if you can, and keep other people back.',
          'Do not move someone who is injured unless they are in danger where they lie.',
          'Wave the responders down when you see them.',
        ],
      },
      { type: 'subheading', text: 'Not an emergency?' },
      {
        type: 'text',
        text: 'For lost property, noise, an old report or a general question, go to the front desk of the nearest police station. It keeps the emergency line free for the people who need it.',
      },
      { type: 'links', items: [{ to: 'city.gov', label: 'City Services', note: 'Opening hours and what City Hall helps with' }] },
    ],
  },

  // Dev only: a real page in the frame.
  { address: 'rules.city', title: 'Server Rules', bookmark: true, url: 'https://example.com' },
];

const handlers: Record<string, MockHandler> = {
  'browser:sites': () => ok({ home: 'home', sites }),
};

export default handlers;
