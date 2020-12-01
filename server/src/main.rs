mod board;
mod config;
mod cursors;
mod digit;
mod error;
mod global_state;
mod realtime;
mod room;
mod sql;

use log::{error, info, warn};
use signal_hook::iterator::Signals;
use signal_hook::{SIGINT, SIGQUIT, SIGTERM};
use std::sync::Arc;
use tokio::sync::oneshot;
use tokio::task;

use crate::global_state::GlobalState;

async fn signal_listener(shutdown_tx: oneshot::Sender<()>) {
    let result = task::spawn_blocking(move || {
        // signal_hook doesn't support tokio 0.2 or 0.3 yet (but will soon)
        // https://github.com/vorner/signal-hook/pull/51
        // For now, run the signal hook in a separate thread.
        let signals = match Signals::new(&[SIGINT, SIGQUIT, SIGTERM]) {
            Ok(s) => s,
            Err(err) => {
                error!("Failed to set up signal hook due to '{}'. Exiting.", err);
                std::process::exit(1);
            }
        };
        for sig in signals.forever() {
            match sig {
                SIGINT | SIGQUIT | SIGTERM => {
                    info!("Shutting down HTTP server.");
                    let result = shutdown_tx.send(());
                    if result.is_err() {
                        error!(concat!(
                            "Failed to send shutdown signal to HTTP server. ",
                            "Exiting uncleanly. This may lose user data."
                        ));
                        std::process::exit(1);
                    }
                    return;
                }
                _ => {}
            }
        }
    })
    .await;
    if let Err(err) = result {
        error!("Signal listener failed to complete: {}", err);
    }
}

#[tokio::main]
async fn main() {
    let config = config::get_config().unwrap();
    config.logging.to_dispatch().apply().unwrap();

    info!("Starting server");

    if !cfg!(feature = "sql") {
        warn!(concat!(
            "The 'sql' feature was not compiled into this binary. Database settings will be ",
            "ignored, and data will not persist across server restarts."
        ));
    }

    let db_pool = Arc::new(sql::new_pool(&config.database).await.unwrap());
    let global_state: Arc<GlobalState> = Arc::new(Default::default());
    let realtime_api = realtime::get_filter(global_state.clone(), db_pool.clone());

    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    let (_addr, server) = warp::serve(realtime_api)
        .bind_with_graceful_shutdown(config.listen_addr, async { shutdown_rx.await.unwrap() });

    tokio::join!(server, signal_listener(shutdown_tx));

    info!("HTTP server stopped");
    if cfg!(feature = "sql") {
        info!("Flushing global state to database");
        sql::writeback(&db_pool, &global_state).await.unwrap();
    }

    info!("Graceful shutdown succeeded")
}
