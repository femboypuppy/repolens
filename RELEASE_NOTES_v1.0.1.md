## RepoLens v1.0.1

### 🚀 Highlights & New Features

1. **GitHub Account Direct Import**:
   - Directly import and batch-clone all repositories from any GitHub user or organization account.
   - Access from Toolbar, Sidebar, First-Run screen, or Command Palette (<kbd>Ctrl+K</kbd> / <kbd>Cmd+K</kbd>).
   - Filter by sources, forks, or language; select-all or pick individual repositories.
   - Choose clone destination directory with native folder browser, and choose HTTPS or SSH protocol.
   - Real-time batch cloning progress bar and automatic workspace registration.
   - Optional Personal Access Token for private repositories and higher rate limits.

2. **Fixed "Invalid Date" in Activity Summary**:
   - Fixed day key resolution in `formatDayHeading` so headers properly display "Today", "Yesterday", and weekday labels instead of "Invalid Date".

3. **Performance & Responsiveness (Zero Button Lag on 1080p)**:
   - Fixed timeframe button click latency: activity commits for the last 30 days are cached in-memory and filtered in 0ms without re-spawning Git subprocesses on every tab click.
   - Added tactile `:active` micro-scaling feedback (`scale(0.97)`) and hardware-accelerated transitions.
   - Optimized button transition timing to 100ms for instantaneous desktop feel.

4. **Visual Design Polish**:
   - Upgraded dark mode palette to rich midnight charcoal (`#0c1017` / `#111724`) with subtle borders and clear contrast.
   - Redesigned commit activity cards with branch badges, one-click hash copying, and enhanced typography.
