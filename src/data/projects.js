const projects = [
  {
    title: 'At The Fire',
    description:
      'At The Fire is a subscription-based social media, business software, and gallery site designed for artists to showcase their collections and offer their work for sale. Collectors are welcome to subscribe as well. The platform features a tiered subscription model; basic accounts are free, while a paid subscription unlocks business accounting and sales analysis tools. Artists can create posts, manage inventory, track sales, analyze production, set goals & monitor performance.',
    mediaType: 'video',
    mediaSrc:
      'https://d5fmwpj8iaraa.cloudfront.net/atf-assets/at-the-fire-subscription-2.mp4',
    poster:
      'https://d5fmwpj8iaraa.cloudfront.net/atf-assets/logo-icon-6-512+x+911.png',
    links: [
      { label: 'Website Home', href: 'https://atthefire.com' },
      {
        label: 'Detailed Tech Stack',
        href: 'https://atthefire.com/about-project',
      },
    ],
  },
  {
    title: 'MCP Server / Local LLM Coding Assistant',
    subtitle: 'MCP Server/ Local LLM Coding Assistant, Email Analyzer & Appointment Setter',
    description:
      'This project is a fully local & private AI assistant that runs entirely on your own machine- no internet required and all your data is encrypted. It leverages open-source large language models (LLMs) to provide coding help, analyze emails, and schedule appointments via tool calls facilitated by the MCP server, all while keeping your data private and secure. The app features a user-friendly interface for interacting with the AI, and integrates with local tools for seamless workflow automation. Built with Node.js, Express, WSL & Linux, the mcp server sdk, and a React frontend, it demonstrates how modern AI capabilities can be delivered without relying on cloud services or external APIs.',
    mediaType: 'image',
    mediaSrc: '/images/code-assist.png',
    links: [
      {
        label: 'Demo Deploy (display only)',
        href: 'https://my-coding-assistant.netlify.app/',
      },
      {
        label: 'Github',
        href: 'https://github.com/kevinnail/my-chatbot',
      },
    ],
  },
  {
    title: 'MJ Cheat Sheet',
    subtitle: 'MJ Cheat Sheet: AI-Powered RAG Cannabis Intelligence App',
    description:
      'MJ Cheat Sheet is an advanced AI-driven platform that facilitates finding the right cannabis product for a customer with unique needs. Our smart search and AI assistant, the Big Lebowlski, processes cannabis data to provide intelligent strain analysis, effect predictions, and personalized recommendations. The AI continuously learns from user interactions and new product data, ensuring accurate and up-to-date insights. If a product/ strain is missing, users can create or update the database that all users draw from.',
    mediaType: 'image',
    mediaSrc: '/images/mj-cheat-sheet.png',
    links: [
      {
        label: 'Website Home',
        href: 'https://mj-cheat-sheet-be-production.up.railway.app',
      },
      {
        label: 'About: Tech Stack Details',
        href: 'https://mj-cheat-sheet-be-production.up.railway.app/about',
      },
    ],
  },
  {
    title: 'Stress Less Glass',
    description:
      "A company created by yours truly: I've been self employed blowing glass for a living for 26 yrs, and I built this site to help me display and sell my glass to collectors. This solo project is React/ Node/ Express and it has an admin page with a list of posts where I can manage all my content. All images are uploaded to/ hosted on Cloudinary via their SDK on my Express server. A work in progress- V2 will allow video uploads as well as a inventory summary/ detail page, coming soon because I need to sell some glass while looking for development work :)",
    mediaType: 'video',
    mediaSrc: '/images/preview.mp4',
    poster: '/images/logo-sq-poster.png',
    links: [
      {
        label: 'Gallery Page',
        href: 'https://fs-react-exp-gallery-kn.netlify.app/main-gallery',
      },
      {
        label: 'GitHub (React Front End)',
        href: 'https://github.com/kevinnail/fs-react-exp-gallery-frontend',
      },
      {
        label: 'GitHub (Node/ Express Back End)',
        href: 'https://github.com/kevinnail/fs-react-exp-gallery-backend',
      },
    ],
  },
  {
    title: 'Error Affirmations',
    description:
      'This group project is actually a set of apps that work together and share a database: a custom Jest reporter, a VS Code extension, and a website for users to add to (we are up to 2.8K users and growing!). The Jest reporter adds an affirmation to your terminal upon any failed tests. It is customizable with different themes. The extension has an affirmation presented on opening VS Code, and offers affirmations on command. Users can also log into our website and add to the list of affirmations which will be added to the database all the apps draw from.',
    mediaType: 'image',
    mediaSrc: '/images/error.png',
    links: [
      {
        label: 'VS Code Extension',
        href: 'https://marketplace.visualstudio.com/items?itemName=VSCodeEmpaths.erroraffirmations',
      },
      {
        label: 'NPM Package Jest Reporter',
        href: 'https://www.npmjs.com/package/error-affirmations',
      },
      {
        label: 'Website',
        href: 'https://error-affirmations.netlify.app/',
      },
      {
        label: 'GitHub',
        href: 'https://github.com/orgs/VSCode-Empaths/repositories',
      },
    ],
  },
];

export default projects;
