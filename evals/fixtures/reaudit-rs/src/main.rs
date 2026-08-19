use reaudit_rs::cli;
use reaudit_rs::config;
use reaudit_rs::render;
use reaudit_rs::store;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let path = &args[1];
    let cli = cli::parse(&args);
    let cfg = match config::load(path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(2);
        }
    };
    let snapshot = store::load_snapshot(&cfg.snapshot_path);
    println!("{}", render::render(&cfg, &snapshot, cli.verbose));
    // exit code requested by the config file
    let code: i64 = cfg.exit_code;
    std::process::exit((code as u8) as i32);
}
