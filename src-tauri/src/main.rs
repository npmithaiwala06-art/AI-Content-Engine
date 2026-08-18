#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let mut args = std::env::args();
    let _executable = args.next();
    if args.next().as_deref() == Some("--scheduler-once") {
        let Some(database_path) = args.next() else {
            eprintln!("SocialFlow scheduler requires a database path");
            std::process::exit(2);
        };
        match socialflow_os_lib::run_scheduler_once(database_path.into()) {
            Ok(processed) => {
                println!("SocialFlow scheduler processed {processed} queued item(s)");
                return;
            }
            Err(error) => {
                eprintln!("SocialFlow scheduler failed: {error}");
                std::process::exit(1);
            }
        }
    }
    socialflow_os_lib::run();
}
