use chrono::{SecondsFormat, Utc};
use clap::Clap;
use fern::colors::{Color, ColoredLevelConfig};
use serde::Deserialize;
use std::error::Error;
use std::fs;
use std::io;
use std::net::SocketAddr;

#[derive(Clap)]
#[clap(author, about, version)]
pub struct Args {
    #[clap(short = 'c', long, default_value = "sudoku.toml")]
    config: String,
    #[clap(short = 'a', long)]
    listen_addr: Option<SocketAddr>,
    #[clap(short = 'l', long)]
    log_level: Option<log::LevelFilter>,
}

#[derive(Deserialize)]
pub struct Config {
    #[serde(default = "default_listen_addr")]
    pub listen_addr: SocketAddr,
    #[serde(default)]
    pub logging: LoggingConfig,
}

impl Config {
    pub fn apply_args(&mut self, args: Args) {
        if let Some(listen_addr) = args.listen_addr {
            self.listen_addr = listen_addr;
        }
        if let Some(log_level) = args.log_level {
            self.logging.level = log_level;
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        toml::from_str("").unwrap()
    }
}

#[derive(Deserialize)]
pub struct LoggingConfig {
    pub level: log::LevelFilter,
    pub color: bool,
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: log::LevelFilter::Info,
            color: true,
        }
    }
}

fn default_listen_addr() -> SocketAddr {
    "127.0.0.1:9091".parse().unwrap()
}

impl LoggingConfig {
    pub fn to_dispatch(&self) -> fern::Dispatch {
        let colors = ColoredLevelConfig::new()
            .error(Color::Red)
            .warn(Color::Yellow);
        fern::Dispatch::new()
            .level(self.level)
            .format(move |out, message, record| {
                out.finish(format_args!(
                    "{} [{}] [{}] {}",
                    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
                    colors.color(record.level()),
                    record.target(),
                    message
                ))
            })
            .chain(std::io::stdout())
    }
}

pub fn get_config() -> Result<Config, Box<dyn Error>> {
    let args = Args::parse();
    let toml_str = fs::read(&args.config).or_else(|err| {
        if err.kind() == io::ErrorKind::NotFound {
            // println because logging isn't initialized yet
            println!(
                "No config file found in {}, using defaults instead.",
                args.config
            );
            Ok(Vec::new())
        } else {
            Err(err)
        }
    })?;
    let mut config: Config = toml::from_slice(&toml_str).map_err(|err| {
        println!("Error while reading {}: {}", args.config, err);
        err
    })?;
    config.apply_args(args);
    Ok(config)
}
