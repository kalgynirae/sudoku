# sudoku-server

Provides co-op multiplayer functionality for the sudoku webapp. This component
is optional and is only needed for multiplayer.

Most changes to the board are expressed as sets of "diffs", which are
[operational
transforms](https://en.wikipedia.org/wiki/Operational_transformation) (this is
the same model Google Docs uses). These diffs are encoded as JSON and sent over
a websocket. The server is responsible for ordering and broadcasting these
messages, as well as maintaining the current state for new clients joining.

Some changes to the board (i.e. player cursors) don't require operational
transformation since changes aren't overlapping, and are instead simply
broadcast by the server.

The server is inherently stateful. Most data is held in memory for performance
reasons and is only periodically flushed back to an on-disk database, so if the
server exits uncleanly, some data may be lost. This seems like an acceptable
tradeoff for this type of application.

If needed (unlikely), future horizonal scaling could theoretically be achieved
through sharding or by moving the in-memory state to a separate in-memory
database supporting pub/sub (e.g. Redis).

## Dependencies

Install a rust toolchain `>= 1.48.0`. Installing through
[rustup](https://rustup.rs/) is recommended.

You'll also need rustfmt and clippy for development (not needed to compile),
both of which can be installed through rustup:

```
rustup component add rustfmt
rustup component add clippy
```

## Common Cargo Commands

### Build

- `cargo build`: Builds a debug version into `target/debug`. The first build may
  be slow as it downloads and builds all the dependencies, but debug builds are
  incrementally compiled, and incremental builds should only take a couple
  seconds.
- `cargo build --release`: Builds an optimized release version into
  `target/release`.
- `cargo check`: Compiles the code, but skips LLVM and codegen. Use this while
  developing to get compile errors faster.

### Run

- `cargo run`: Compiles (if needed) and runs the debug build.
- `cargo test`: Runs the test suite.

When running a local instance of the server, load the webapp with `?localhost` 
in the URL so that it looks for the server on localhost.

### Development Tools

- `cargo clippy`: Runs the clippy linter.
- `cargo fmt`: Runs the auto-formatter. Run this before committing.

## Configuration

Configuration options are set in `sudoku.toml`. This is a
[TOML](https://toml.io/) file. The server searches the cwd for this file.

Some options (including the path to the config file) can be set via command line
flags. Run `./sudoku-server --help` or `cargo run -- --help` to see the options.

## Database Operations

The SQL database support is optional. You can build without SQL support by
passing `--no-default-features` to `cargo` when building, running, or testing.

If you want to make changes to SQL queries or the SQL schema, install [the sqlx
cli utility](https://github.com/launchbadge/sqlx/tree/master/sqlx-cli):

```
cargo install --version=0.2.0 sqlx-cli
```

If you change a SQL query, you'll need to run `cargo sqlx prepare` before you
commit. During development, it may be useful to override `SQLX_OFFLINE`. See the
hidden `.env` file for details.
