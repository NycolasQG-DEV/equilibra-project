// Initial commercial proposal; prices and quotas can be replaced through BILLING_PLANS_JSON.
module.exports = [
  {
    id: "essencial",
    name: "Essencial",
    amountCents: 14900,
    members: 50,
    groups: 3,
    users: 2,
    organizations: 1,
  },
  {
    id: "popular",
    name: "Popular",
    amountCents: 34900,
    members: 200,
    groups: 12,
    users: 5,
    organizations: 1,
  },
  {
    id: "avancado",
    name: "Avançado",
    amountCents: 79900,
    members: 600,
    groups: 40,
    users: 12,
    organizations: 1,
  },
];
