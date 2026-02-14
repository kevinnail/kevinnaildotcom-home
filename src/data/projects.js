const projects = [
  {
    title: 'At The Fire',
    description: `
    Pre-launch full-stack creator platform I’m designing and building 
    end-to-end (with a small team when time allows), 
    expanding on the production patterns from Stress Less Glass into a multi-tenant 
    app with social features and subscriptions. I implemented React-based gallery + 
    business dashboards (Zustand, Material UI, drag-and-drop uploads, client-side image 
    compression) and analytics visualizations (Chart.js). On the backend (Node/Express + 
    Postgres), I integrated AWS Cognito authentication, Stripe subscriptions with 
    webhooks for entitlement updates, S3 + CloudFront for optimized media delivery,
     and Socket.IO for real-time messaging. I added Redis caching, CSP/security hardening 
     (Helmet) and AES-256 encryption for sensitive data, plus unit/integration/UI tests with 
     Jest, Supertest, and Testing Library (ESLint/Prettier enforced).
     `,
    mediaType: 'video',
    mediaSrc: 'https://d5fmwpj8iaraa.cloudfront.net/atf-assets/at-the-fire-subscription-2.mp4',
    poster: 'https://d5fmwpj8iaraa.cloudfront.net/atf-assets/logo-icon-6-512+x+911.png',
    links: [
      { label: 'Website Home', href: 'https://atthefire.com' },
      {
        label: 'Detailed Tech Stack',
        href: 'https://atthefire.com/about-project',
      },
    ],
  },

  {
    title: 'Stress Less Glass',
    description: `Production full-stack web app I built and operate for my glass business (69+ registered users), giving me hands-on experience shipping updates safely while protecting real customer data. Built with React + Node/Express + Postgres and an AWS S3 media pipeline via the AWS SDK. I implemented an admin-first dashboard for managing content (published/hidden/soft-deleted states), maintaining an inventory list with filtering, and tracking sales. I also delivered real-time features with WebSockets (Socket.IO): live auctions with instant bid updates and one-to-one customer messaging (users message the admin; admin can message any user). Integrated opt-in email notifications via a mailer service and built the preference workflow so users can subscribe/unsubscribe from notifications.`,
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
    title: 'MCP Server / Local LLM Coding Assistant',
    subtitle: 'Local RAG Assistant + MCP Tooling (Gmail → Calendar)',
    description: `Full-stack, fully local AI assistant I built to explore production-style
     agent workflows without sending data to third-party AI services. The app runs 
     on Ollama for local inference and uses PostgreSQL + pgvector for semantic 
     memory (embeddings) with a hybrid retrieval strategy (recent + relevant 
     context) to keep conversations coherent. I implemented an MCP server 
     (HTTP/SSE transport) that exposes real tools to the model, including Google 
     Calendar event creation; the agent analyzes emails and triggers tool calls to 
     schedule appointments automatically. Integrated Gmail via IMAP for local email sync + 
     vector-based filtering before LLM analysis, added OAuth for Google Calendar, and 
     used WebSockets for real-time UI progress updates. Built with React + Express/Node 
     on WSL/Linux, with Jest/Supertest coverage for API + memory/retrieval behavior.
     `,
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
