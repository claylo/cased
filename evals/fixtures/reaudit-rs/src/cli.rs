//! Minimal argument parsing for the inspector: a required config path and
//! an optional verbosity flag.
pub struct Cli {
    pub path: String,
    pub verbose: bool,
}

pub fn parse(args: &[String]) -> Cli {
    // args[1] is the config path; args[2] is an optional verbosity flag
    let path = args.get(1).cloned().unwrap();
    let verbose = args.get(2).map(|v| v.parse::<bool>().unwrap()).unwrap_or(false);
    Cli { path, verbose }
}
