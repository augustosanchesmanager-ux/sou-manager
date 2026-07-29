/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: "no-domain-imports-react",
      comment: "Domain layer must not import React or any React hooks",
      severity: "error",
      from: { path: "^domain/" },
      to: {
        anyOf: [
          { path: "^react$" },
          { path: "^react-" },
          { path: "from 'react'" },
        ],
      },
    },
    {
      name: "no-domain-imports-ui",
      comment: "Domain layer must not import from components or pages",
      severity: "error",
      from: { path: "^domain/" },
      to: {
        anyOf: [
          { path: "^components/" },
          { path: "^pages/" },
          { path: "^src/components/" },
          { path: "^src/modules/" },
        ],
      },
    },
    {
      name: "no-application-imports-supabase-directly",
      comment: "Application services must not import raw Supabase client (only through domain factory for RPCs)",
      severity: "warn",
      from: { path: "^application/" },
      to: {
        anyOf: [
          { path: "^src/lib/supabase/client\\.ts$" },
          { path: "from '@supabase/supabase-js'" },
        ],
      },
    },
    {
      name: "no-components-imports-repository",
      comment: "Components must not import domain repositories",
      severity: "error",
      from: {
        anyOf: [
          { path: "^components/" },
          { path: "^src/components/" },
          { path: "^src/modules/" },
        ],
      },
      to: { path: "^domain/.*/repository" },
    },
    {
      name: "no-hooks-imports-repository",
      comment: "Hooks must not import domain repositories (should go through Application Services)",
      severity: "warn",
      from: {
        anyOf: [{ path: "^hooks/" }, { path: "^src/hooks/" }],
      },
      to: { path: "^domain/.*/repository" },
    },
    {
      name: "no-components-imports-supabase",
      comment: "Components must not import Supabase client",
      severity: "error",
      from: {
        anyOf: [
          { path: "^components/" },
          { path: "^src/components/" },
          { path: "^src/modules/" },
        ],
      },
      to: {
        anyOf: [
          { path: "^src/lib/supabase/" },
          { path: "from '@supabase/" },
        ],
      },
    },
    {
      name: "no-hooks-imports-supabase",
      comment: "Hooks must not import Supabase client directly",
      severity: "warn",
      from: {
        anyOf: [{ path: "^hooks/" }, { path: "^src/hooks/" }],
      },
      to: {
        anyOf: [
          { path: "^src/lib/supabase/" },
          { path: "from '@supabase/" },
        ],
      },
    },
    {
      name: "no-circular-dependencies",
      comment: "No circular dependencies allowed",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: false,
    tsConfig: { fileName: "./tsconfig.json" },
  },
};
