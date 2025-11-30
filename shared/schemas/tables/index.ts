// Export all tables in topological order (dependencies resolved before dependents)
// Each domain index exports its own tables

// Base enums, constants, and utility imports
export * from '../base';

// Auth domain - independent tables (users is the base for most relations)
export * from '../auth';

// Products domain - depends on auth/users
export * from '../products';

// Wallet domain - depends on auth/users  
export * from '../wallet';

// Messages domain - depends on auth/users, products
export * from '../messages';

// Social domain - depends on auth/users
export * from '../social';

// Games domain - depends on auth/users
export * from '../games';

// VTU domain - depends on auth/users, wallet
export * from '../vtu';

// Reseller domain - depends on auth/users
export * from '../reseller';

// Stories domain - depends on auth/users
export * from '../stories';

// Confessions domain - depends on auth/users
export * from '../confessions';

// Communities domain - depends on auth/users
export * from '../communities';

// Notifications domain - depends on auth/users
export * from '../notifications';

// Support domain - depends on auth/users, products
export * from '../support';

// Hostels domain - depends on auth/users
export * from '../hostels';

// Misc domain - depends on auth/users
export * from '../misc';

// Study materials domain - depends on auth/users
export * from '../study-materials';

// KYC domain - depends on auth/users
export * from '../kyc';

// Ads domain - depends on auth/users, products
export * from '../ads';

// Rewards domain - depends on auth/users
export * from '../rewards';
