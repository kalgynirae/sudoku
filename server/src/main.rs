mod board;
mod config;
mod cursors;
mod digit;
mod error;
mod global_state;
mod realtime;
mod room;

use log::info;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::global_state::GlobalState;

#[tokio::main]
async fn main() {
    let config = config::get_config().unwrap();
    config.logging.to_dispatch().apply().unwrap();

    info!("starting server");

    let global_state: Arc<Mutex<GlobalState>> = Arc::new(Mutex::new(Default::default()));

    let realtime_api = realtime::get_filter(global_state);

    warp::serve(realtime_api).run(config.listen_addr).await;
}
