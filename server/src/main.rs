mod board;
mod cursors;
mod digit;
mod error;
mod global_state;
mod realtime;
mod room;

use log::info;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::global_state::GlobalState;

#[tokio::main]
async fn main() {
    env_logger::init();
    info!("starting server");

    let global_state: Arc<Mutex<GlobalState>> = Arc::new(Mutex::new(Default::default()));

    let realtime_api = realtime::get_filter(global_state);

    warp::serve(realtime_api)
        .run("127.0.0.1:9091".parse::<SocketAddr>().unwrap())
        .await;
}
