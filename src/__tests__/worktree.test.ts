import {
  branchName,
  findExistingRepo,
  normalizeRepoRef,
  repoLocalPath,
  remoteMatchesRepo,
  worktreePath
} from '../worktree.js'

test('worktreePath returns predictable path', () => {
  const p = worktreePath('TOOL-48', '/base/repo')
  expect(p).toBe('/base/.agent-worktrees/TOOL-48')
})

test('branchName uses agent/ prefix', () => {
  expect(branchName('TOOL-48')).toBe('agent/TOOL-48')
})

test('repoLocalPath extracts repo name from owner/name', () => {
  const p = repoLocalPath('Codefied/AI-Analysts')
  expect(p).toContain('AI-Analysts')
})

test('normalizeRepoRef handles GitHub HTTPS and SSH remotes', () => {
  expect(normalizeRepoRef('https://github.com/Codefied/human-road-warrior.git')).toBe('codefied/human-road-warrior')
  expect(normalizeRepoRef('git@github.com:Codefied/human-road-warrior.git')).toBe('codefied/human-road-warrior')
  expect(normalizeRepoRef('Codefied/human-road-warrior')).toBe('codefied/human-road-warrior')
})

test('remoteMatchesRepo compares normalized remote URLs to repo labels', () => {
  expect(remoteMatchesRepo('https://github.com/Codefied/human-road-warrior.git', 'Codefied/human-road-warrior')).toBe(true)
  expect(remoteMatchesRepo('https://github.com/Codefied/AI-Analysts.git', 'Codefied/human-road-warrior')).toBe(false)
})

test('findExistingRepo prefers an existing matching checkout before managed clones', () => {
  const existingPath = '/Users/jakefassora/projects/human-road-warrior-v2'
  const managedPath = '/Users/jakefassora/.agent-queue/repos/human-road-warrior'
  const found = findExistingRepo('Codefied/human-road-warrior', {
    home: '/Users/jakefassora',
    reposDir: '/Users/jakefassora/.agent-queue/repos',
    envPaths: [],
    exists: candidate => candidate === existingPath || candidate === managedPath,
    readdir: dir => dir === '/Users/jakefassora/projects' ? ['human-road-warrior-v2'] : [],
    getRemoteUrl: candidate => {
      if (candidate === existingPath) return 'https://github.com/Codefied/human-road-warrior.git'
      if (candidate === managedPath) return 'https://github.com/Codefied/human-road-warrior.git'
      return undefined
    }
  })

  expect(found).toBe(existingPath)
})

test('repoLocalPath returns an existing matching local checkout when one is discovered', () => {
  const p = repoLocalPath('Codefied/human-road-warrior', {
    home: '/Users/jakefassora',
    reposDir: '/Users/jakefassora/.agent-queue/repos',
    envPaths: [],
    exists: candidate => candidate === '/Users/jakefassora/projects/human-road-warrior-v2',
    readdir: dir => dir === '/Users/jakefassora/projects' ? ['human-road-warrior-v2'] : [],
    getRemoteUrl: candidate => candidate.endsWith('human-road-warrior-v2')
      ? 'git@github.com:Codefied/human-road-warrior.git'
      : undefined
  })

  expect(p).toBe('/Users/jakefassora/projects/human-road-warrior-v2')
})
