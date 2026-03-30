/** @type {import('@tomehq/core').TomeConfig} */
export default {
  name: "bw-swarm",
  theme: {
    preset: "amber",
    mode: "auto",
  },
  navigation: [
    {
      group: "Overview",
      pages: ["index"],
    },
    {
      group: "Concepts",
      pages: [
        "concepts/architecture",
        "concepts/data-flow",
        "concepts/repo-layout",
        "concepts/glossary",
      ],
    },
    {
      group: "Tutorials",
      pages: ["tutorials/local-dev", "tutorials/kind-quickstart"],
    },
    {
      group: "Guides",
      pages: [
        "guides/deployment",
        "guides/templates",
        "guides/templates-catalog",
      ],
    },
    {
      group: "Reference",
      pages: ["reference/services", "reference/admin-api"],
    },
  ],
  // socialLinks: [
  //   { platform: "github", url: "https://github.com/your-org/your-repo" },
  //   { platform: "twitter", url: "https://x.com/your-handle" },
  // ],
};
