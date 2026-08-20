const resume = {
  name: 'Kevin Nail',
  title: 'Full Stack Developer',
  location: 'Eugene, OR',
  // Phone is deliberately absent — see VITE_RESUME_PHONE in Resume.jsx.
  email: 'kevin@kevinnail.com',
  links: [
    { label: 'kevinnail.com', href: 'https://kevinnail.com' },
    { label: 'Github', href: 'https://github.com/kevinnail' },
  ],

  summary: `I bring a unique blend of technical skills and years of business leadership. From running a
    glass art business to developing modern web applications, I'm always trying to learn what's new.
    I'm continuously expanding my expertise by integrating advanced technologies with a deep
    understanding of marketing, branding, and user experience. My focus is on building practical tools
    that work well for people, including myself. I'm focused on end users, providing them solutions
    that meet real world needs with an aesthetic touch.`,

  projects: [
    {
      title: 'RAG/ Local MCP Server/ AI Coding and WebDev Assistant',
      description: `AI Coding Assistant or Career Coach chat modes with file upload/ chunking for
        semantic search and Gmail sync/ analysis/ summary generation with Google Calendar event
        creation if appointments are detected in analysis. All locally run with Ollama in WSL/ Linux/
        Ubuntu`,
      highlights: [
        'MCP Server facilitating tool calls with HTTP transport and MCP SDK',
        '2 chatbot versions- Coding Assistant and Career/ Job Search Coach',
        'Uses pgvector in Postgres for embeddings enabling large context window utilization for coherent chats',
      ],
      links: [
        {
          label: 'my-coding-assistant.netlify.app (demo)',
          href: 'https://my-coding-assistant.netlify.app',
        },
        {
          label: 'github.com/kevinnail/my-chatbot',
          href: 'https://github.com/kevinnail/my-chatbot',
        },
      ],
    },
    {
      title: 'At The Fire - Gallery & Business Management Platform',
      description: `A pre-launch subscription-based marketplace & platform that integrates social
        media, business tools, and an online gallery for artists and collectors.`,
      // Two-column bullet list in the original layout; kept as one list and
      // columned with CSS so reordering stays a single-array edit.
      highlights: [
        'Stripe SDK- eCommerce',
        'Public Gallery/ User Profiles',
        'User Dashboard',
        'Image upload/ storage',
        'Realtime messaging',
        'Inventory Mgt/ Accounting',
        'Graphical display of data',
        'Encryption of sensitive data',
        'Admin Dashboard',
        'Live auctions/ Sales',
      ],
      columns: 2,
      links: [
        {
          label: 'github.com/At-The-Fire/at-the-fire',
          href: 'https://github.com/At-The-Fire/at-the-fire',
        },
        { label: 'atthefire.com', href: 'https://atthefire.com' },
      ],
    },
    {
      title: 'Stress Less Glass - Business Website',
      description: 'Responsive full-stack website for my glass business that includes:',
      highlights: [
        'Customer Gallery: A modern, visually engaging interface for browsing products.',
        'Admin Dashboard: Manage image uploads, posts, sales, and export inventory.',
        'Live/ real time auction platform',
      ],
      links: [
        {
          label: 'stresslessglass.kevinnail.com',
          href: 'https://stresslessglass.kevinnail.com/main-gallery',
        },
        {
          label: 'github.com/kevinnail/fs-react-exp-gallery-frontend',
          href: 'https://github.com/kevinnail/fs-react-exp-gallery-frontend',
        },
        {
          label: 'github.com/kevinnail/fs-react-exp-gallery-backend',
          href: 'https://github.com/kevinnail/fs-react-exp-gallery-backend',
        },
      ],
    },
  ],

  techStack: [
    {
      label: 'Backend',
      items: `Node.js, Express, PostgreSQL- pgvector, SQLite, Redis, Linux- WSL, REST- Webhooks,
        Auth- JWT- AWS Cognito, Stripe, WebSockets- Socket.IO, Helmet- CSP, Multer, CryptoJS`,
    },
    {
      label: 'Frontend',
      items: `React, React Native, Typescript, HTML5, CSS3, MUI, Zustand, Router, Chart.js-
        react-chartjs-2, date-fns, Toastify, Dropzone, Swipeable, Modal`,
    },
    {
      label: 'AI- LLM',
      items: `Ollama- local models, MCP Server- agentic tool calling, RAG on Postgres- pgvector,
        OpenAI, NEAR AI, Agent SDK- orchestration`,
    },
    {
      label: 'Ops & DX',
      items: `AWS S3 + CloudFront, Supabase, Cloudinary, Jest- Supertest, Testing Library,
        Playwright, Expo/ Expo Go/ EAS, ESLint- Prettier, Git- GitHub- Git Bash, Claude Code, Cursor,
        VS Code, Postman, Beekeeper Studio, TDD, Pair- Mob Programming, Slack- Discord, Whimsical-
        Miro- Canva- GIMP, Excel- VBA, Core-FTP`,
    },
  ],

  experience: [
    {
      role: 'Owner- Full stack Developer',
      company: 'Stress Less Glass',
      description: `Operate a glass art business while independently designing, building, and
        maintaining its full-stack platform (React, Node/Express, Postgres). Created inventory
        tracking, analytics exports, and an image upload dashboard, alongside handling all business
        operations including product development, sales, marketing, and logistics.`,
      highlights: [
        'Built full stack site for catalog and inventory- Node.js- Express- React- PostgreSQL',
        'Implemented image storage and CDN- AWS S3 + CloudFront; added Redis cache for gallery queries and product images',
        'Developed owner dashboard- upload images, tag items, set pricing, publish or archive listings- standard CRUD',
        'Designed Postgres schema for products and categories- wrote SQL for inventory updates and admin views',
        'Added security headers and basics- Helmet- CSP, input validation, error handling',
        'Maintained version control and releases- Git- GitHub- structured commits and docs',
        'Tech highlights: Node.js, Express, React, PostgreSQL, Redis, AWS S3 + CloudFront, Helmet, SQL, Git- GitHub',
      ],
    },
  ],
};

export default resume;
