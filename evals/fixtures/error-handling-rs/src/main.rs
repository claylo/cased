use std::env;
use std::io;
use std::path::PathBuf;

fn main() {
    let args: Vec<String> = env::args().collect();
    let path = PathBuf::from(&args[1]);
    let overrides: Vec<String> = args[2..].to_vec();

    match confetti::merge_config(&path, &overrides) {
        Ok(entries) => {
            let mut stdout = io::stdout().lock();
            if let Err(e) = confetti::render::render_table(&mut stdout, &entries) {
                eprintln!("confetti: render failed: {e}");
                std::process::exit(1);
            }
        }
        Err(message) => {
            eprintln!("confetti: {message}");
            std::process::exit(2);
        }
    }
}
