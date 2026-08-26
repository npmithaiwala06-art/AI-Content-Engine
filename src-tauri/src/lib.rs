mod ai_workspace;
mod analytics;
mod approvals;
mod automation;
mod background;
mod calendar;
mod campaigns;
mod chatgpt;
mod clients;
mod content_importer;
mod content_studio;
mod database;
mod error;
mod local_ai;
mod media_library;
mod oauth;
#[allow(dead_code)]
mod platforms;
mod readiness;
mod reports;
mod security;
mod social_accounts;
mod workspace;

use std::path::PathBuf;

use database::{DashboardSummary, Database};
use error::AppError;
use tauri::{Manager, State};
use tauri_plugin_opener::OpenerExt;

use ai_workspace::{AiPromptHistoryItem, CampaignOption, SaveAiPromptInput};
use analytics::{
    AnalyticsDashboard, OfficialAnalyticsCollection, RecommendationInput, RecommendationRecord,
};
use approvals::ApprovalItem;
use automation::{NotificationRecord, QueueItem};
use background::BackgroundSchedulerStatus;
use calendar::CalendarItem;
use campaigns::{CampaignInput, CampaignRecord, ContentPlanInput, ContentPlanRecord};
use clients::{ClientDetail, ClientInput, ClientSummary, LogoUpload};
use content_importer::{ContentImportSaveResult, ImportPostInput, SaveContentImportInput};
use content_studio::{ContentPostInput, PostDetail, PostSummary};
use local_ai::{LocalAiResult, LocalAiStatus};
use media_library::{MediaRecord, MediaUpload};
use readiness::ReleaseReadiness;
use reports::ReportRecord;
use security::SecurityStatus;
use social_accounts::SocialAccountRecord;
use workspace::{ActivityRecord, BackupRecord, SearchResult, SettingRecord};

#[tauri::command]
fn initialize_application(app: tauri::AppHandle) -> Result<String, AppError> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|_| AppError::AppDataDirectoryUnavailable)?;
    Ok(app_data.to_string_lossy().to_string())
}

#[tauri::command]
fn get_codex_status(
    app: tauri::AppHandle,
    runtime: State<'_, chatgpt::CodexRuntime>,
) -> chatgpt::CodexStatus {
    chatgpt::status(&app, &runtime)
}

#[tauri::command]
fn start_codex_login(
    app: tauri::AppHandle,
    runtime: State<'_, chatgpt::CodexRuntime>,
) -> Result<(), String> {
    chatgpt::start_login(app, runtime.inner().clone())
}

#[tauri::command]
fn logout_codex(
    app: tauri::AppHandle,
    runtime: State<'_, chatgpt::CodexRuntime>,
) -> Result<(), String> {
    chatgpt::logout(&app, &runtime)
}

#[tauri::command]
async fn generate_with_codex(
    app: tauri::AppHandle,
    prompt: String,
) -> Result<chatgpt::CodexGenerationResult, String> {
    chatgpt::generate(app, prompt).await
}

#[tauri::command]
fn get_dashboard_summary(database: State<'_, Database>) -> Result<DashboardSummary, AppError> {
    database.dashboard_summary()
}

#[tauri::command]
fn list_clients(
    database: State<'_, Database>,
    search: Option<String>,
    filter: Option<String>,
    sort: Option<String>,
) -> Result<Vec<ClientSummary>, AppError> {
    clients::list_clients(&database, search, filter, sort)
}

#[tauri::command]
fn get_client(database: State<'_, Database>, client_id: String) -> Result<ClientDetail, AppError> {
    clients::get_client(&database, &client_id)
}

#[tauri::command]
fn create_client(database: State<'_, Database>, input: ClientInput) -> Result<String, AppError> {
    clients::create_client(&database, input)
}

#[tauri::command]
fn update_client(
    database: State<'_, Database>,
    client_id: String,
    input: ClientInput,
) -> Result<(), AppError> {
    clients::update_client(&database, &client_id, input)
}

#[tauri::command]
fn archive_client(database: State<'_, Database>, client_id: String) -> Result<(), AppError> {
    clients::archive_client(&database, &client_id)
}

#[tauri::command]
fn restore_client(database: State<'_, Database>, client_id: String) -> Result<(), AppError> {
    clients::restore_client(&database, &client_id)
}

#[tauri::command]
fn delete_client(database: State<'_, Database>, client_id: String) -> Result<(), AppError> {
    clients::delete_client(&database, &client_id)
}

#[tauri::command]
fn upload_client_logo(
    database: State<'_, Database>,
    upload: LogoUpload,
) -> Result<String, AppError> {
    clients::upload_client_logo(&database, upload)
}

#[tauri::command]
fn list_ai_campaign_options(
    database: State<'_, Database>,
    client_id: String,
) -> Result<Vec<CampaignOption>, AppError> {
    ai_workspace::list_campaign_options(&database, &client_id)
}

#[tauri::command]
fn save_ai_prompt(
    database: State<'_, Database>,
    input: SaveAiPromptInput,
) -> Result<String, AppError> {
    ai_workspace::save_ai_prompt(&database, input)
}

#[tauri::command]
fn list_ai_prompt_history(
    database: State<'_, Database>,
    client_id: Option<String>,
) -> Result<Vec<AiPromptHistoryItem>, AppError> {
    ai_workspace::list_ai_prompt_history(&database, client_id)
}

#[tauri::command]
fn mark_ai_prompt_copied(database: State<'_, Database>, prompt_id: String) -> Result<(), AppError> {
    ai_workspace::mark_ai_prompt_copied(&database, &prompt_id)
}

#[tauri::command]
fn check_import_duplicates(
    database: State<'_, Database>,
    client_id: String,
    posts: Vec<ImportPostInput>,
) -> Result<Vec<String>, AppError> {
    content_importer::check_import_duplicates(&database, &client_id, &posts)
}

#[tauri::command]
fn save_content_import(
    database: State<'_, Database>,
    input: SaveContentImportInput,
) -> Result<ContentImportSaveResult, AppError> {
    content_importer::save_content_import(&database, input)
}

#[tauri::command]
fn list_posts(
    database: State<'_, Database>,
    client_id: Option<String>,
    status: Option<String>,
    search: Option<String>,
) -> Result<Vec<PostSummary>, AppError> {
    content_studio::list_posts(&database, client_id, status, search)
}
#[tauri::command]
fn get_post(database: State<'_, Database>, post_id: String) -> Result<PostDetail, AppError> {
    content_studio::get_post(&database, &post_id)
}
#[tauri::command]
fn save_post(
    database: State<'_, Database>,
    post_id: Option<String>,
    input: ContentPostInput,
) -> Result<String, AppError> {
    content_studio::save_post(&database, post_id, input)
}
#[tauri::command]
fn duplicate_post(database: State<'_, Database>, post_id: String) -> Result<String, AppError> {
    content_studio::duplicate_post(&database, &post_id)
}
#[tauri::command]
fn submit_post_for_review(database: State<'_, Database>, post_id: String) -> Result<(), AppError> {
    content_studio::submit_post_for_review(&database, &post_id)
}
#[tauri::command]
fn delete_draft_post(database: State<'_, Database>, post_id: String) -> Result<(), AppError> {
    content_studio::delete_draft_post(&database, &post_id)
}
#[tauri::command]
fn upload_media(database: State<'_, Database>, upload: MediaUpload) -> Result<String, AppError> {
    media_library::upload_media(&database, upload)
}
#[tauri::command]
fn list_media(
    database: State<'_, Database>,
    client_id: Option<String>,
    kind: Option<String>,
    search: Option<String>,
) -> Result<Vec<MediaRecord>, AppError> {
    media_library::list_media(&database, client_id, kind, search)
}
#[tauri::command]
fn rename_media(
    database: State<'_, Database>,
    media_id: String,
    file_name: String,
) -> Result<(), AppError> {
    media_library::rename_media(&database, &media_id, &file_name)
}
#[tauri::command]
fn delete_media(database: State<'_, Database>, media_id: String) -> Result<(), AppError> {
    media_library::delete_media(&database, &media_id)
}
#[tauri::command]
fn list_attached_media_ids(
    database: State<'_, Database>,
    post_id: String,
    platform: String,
) -> Result<Vec<String>, AppError> {
    media_library::list_attached_media_ids(&database, &post_id, &platform)
}
#[tauri::command]
fn attach_media(
    database: State<'_, Database>,
    post_id: String,
    platform: String,
    media_id: String,
) -> Result<(), AppError> {
    media_library::attach_media(&database, &post_id, &platform, &media_id)
}
#[tauri::command]
fn detach_media(
    database: State<'_, Database>,
    post_id: String,
    platform: String,
    media_id: String,
) -> Result<(), AppError> {
    media_library::detach_media(&database, &post_id, &platform, &media_id)
}
#[tauri::command]
fn list_approval_queue(
    database: State<'_, Database>,
    client_id: Option<String>,
) -> Result<Vec<ApprovalItem>, AppError> {
    approvals::list_approval_queue(&database, client_id)
}
#[tauri::command]
fn approve_post(
    database: State<'_, Database>,
    post_id: String,
    notes: String,
) -> Result<(), AppError> {
    approvals::approve_post(&database, &post_id, &notes)
}
#[tauri::command]
fn reject_post(
    database: State<'_, Database>,
    post_id: String,
    reason: String,
) -> Result<(), AppError> {
    approvals::reject_post(&database, &post_id, &reason)
}
#[tauri::command]
fn list_calendar_items(
    database: State<'_, Database>,
    start: String,
    end: String,
    client_id: Option<String>,
    platform: Option<String>,
    status: Option<String>,
) -> Result<Vec<CalendarItem>, AppError> {
    calendar::list_calendar_items(&database, &start, &end, client_id, platform, status)
}
#[tauri::command]
fn list_schedulable_posts(
    database: State<'_, Database>,
    client_id: Option<String>,
) -> Result<Vec<PostSummary>, AppError> {
    calendar::list_schedulable_posts(&database, client_id)
}
#[tauri::command]
fn schedule_post(
    database: State<'_, Database>,
    post_id: String,
    scheduled_for: String,
    timezone: String,
    account_ids: std::collections::HashMap<String, String>,
) -> Result<Vec<String>, AppError> {
    calendar::schedule_post(&database, &post_id, &scheduled_for, &timezone, account_ids)
}
#[tauri::command]
fn reschedule_post(
    database: State<'_, Database>,
    post_id: String,
    scheduled_for: String,
    timezone: String,
) -> Result<(), AppError> {
    calendar::reschedule_post(&database, &post_id, &scheduled_for, &timezone)
}
#[tauri::command]
fn unschedule_post(database: State<'_, Database>, post_id: String) -> Result<(), AppError> {
    calendar::unschedule_post(&database, &post_id)
}
#[tauri::command]
fn run_scheduler_now(database: State<'_, Database>) -> Result<usize, AppError> {
    automation::tick(&database)
}
#[tauri::command]
fn list_publishing_queue(
    database: State<'_, Database>,
    status: Option<String>,
) -> Result<Vec<QueueItem>, AppError> {
    automation::list_queue(&database, status)
}
#[tauri::command]
fn retry_queue_item(database: State<'_, Database>, queue_id: String) -> Result<(), AppError> {
    automation::retry_queue_item(&database, &queue_id)
}
#[tauri::command]
fn cancel_queue_item(database: State<'_, Database>, queue_id: String) -> Result<(), AppError> {
    automation::cancel_queue_item(&database, &queue_id)
}
#[tauri::command]
fn publish_now(database: State<'_, Database>, schedule_id: String) -> Result<(), AppError> {
    automation::publish_now(&database, &schedule_id)
}
#[tauri::command]
fn list_notifications(database: State<'_, Database>) -> Result<Vec<NotificationRecord>, AppError> {
    automation::list_notifications(&database)
}
#[tauri::command]
fn mark_notification_read(
    database: State<'_, Database>,
    notification_id: String,
) -> Result<(), AppError> {
    automation::mark_notification_read(&database, &notification_id)
}
#[tauri::command]
fn list_social_accounts(
    database: State<'_, Database>,
    client_id: Option<String>,
) -> Result<Vec<SocialAccountRecord>, AppError> {
    social_accounts::list_social_accounts(&database, client_id)
}
#[tauri::command]
fn connect_mock_account(
    database: State<'_, Database>,
    client_id: String,
    platform: String,
    account_name: String,
) -> Result<String, AppError> {
    social_accounts::connect_mock_account(&database, &client_id, &platform, &account_name)
}
#[tauri::command]
fn list_social_oauth_configurations() -> Vec<oauth::OAuthConfiguration> {
    oauth::list_configurations()
}
#[tauri::command]
async fn connect_social_account_with_browser(
    app: tauri::AppHandle,
    input: oauth::BrowserOAuthInput,
) -> Result<oauth::BrowserOAuthResult, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|_| AppError::AppDataDirectoryUnavailable.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        let database = Database::open(&app_data.join("socialflow.sqlite"))
            .map_err(|error| error.to_string())?;
        let browser = app.clone();
        oauth::connect_with_browser(&database, input, move |url| {
            browser
                .opener()
                .open_url(url, None::<&str>)
                .map_err(|error| {
                    AppError::Validation(format!(
                        "Could not open the official sign-in page: {error}"
                    ))
                })
        })
        .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| format!("Secure connection task failed: {error}"))?
}
#[tauri::command]
fn validate_social_account(
    database: State<'_, Database>,
    account_id: String,
) -> Result<(), AppError> {
    social_accounts::validate_account(&database, &account_id)
}
#[tauri::command]
fn disconnect_account(database: State<'_, Database>, account_id: String) -> Result<(), AppError> {
    social_accounts::disconnect_account(&database, &account_id)
}
#[tauri::command]
fn set_mock_failure(
    database: State<'_, Database>,
    account_id: String,
    fail_next: bool,
) -> Result<(), AppError> {
    social_accounts::set_mock_failure(&database, &account_id, fail_next)
}
#[tauri::command]
fn collect_mock_analytics(database: State<'_, Database>) -> Result<usize, AppError> {
    analytics::collect_mock_analytics(&database)
}
#[tauri::command]
fn collect_official_analytics(
    database: State<'_, Database>,
) -> Result<OfficialAnalyticsCollection, AppError> {
    analytics::collect_official_analytics(&database)
}
#[tauri::command]
fn get_analytics_dashboard(
    database: State<'_, Database>,
    client_id: Option<String>,
    platform: Option<String>,
    campaign_id: Option<String>,
    start: String,
    end: String,
) -> Result<AnalyticsDashboard, AppError> {
    analytics::dashboard(&database, client_id, platform, campaign_id, &start, &end)
}
#[tauri::command]
fn build_analytics_prompt(
    database: State<'_, Database>,
    client_id: String,
    start: String,
    end: String,
) -> Result<String, AppError> {
    analytics::analytics_prompt(&database, &client_id, &start, &end)
}
#[tauri::command]
fn import_ai_recommendations(
    database: State<'_, Database>,
    input: RecommendationInput,
) -> Result<String, AppError> {
    analytics::import_recommendations(&database, input)
}
#[tauri::command]
fn list_ai_recommendations(
    database: State<'_, Database>,
    client_id: Option<String>,
) -> Result<Vec<RecommendationRecord>, AppError> {
    analytics::list_recommendations(&database, client_id)
}
#[tauri::command]
fn create_report(
    database: State<'_, Database>,
    client_id: String,
    report_type: String,
    start: String,
    end: String,
    campaign_id: Option<String>,
) -> Result<String, AppError> {
    reports::create_report(
        &database,
        &client_id,
        &report_type,
        &start,
        &end,
        campaign_id,
    )
}
#[tauri::command]
fn list_reports(
    database: State<'_, Database>,
    client_id: Option<String>,
) -> Result<Vec<ReportRecord>, AppError> {
    reports::list_reports(&database, client_id)
}
#[tauri::command]
fn export_report(
    database: State<'_, Database>,
    report_id: String,
    format: String,
) -> Result<String, AppError> {
    reports::export_report(&database, &report_id, &format)
}
#[tauri::command]
fn save_campaign(
    database: State<'_, Database>,
    campaign_id: Option<String>,
    input: CampaignInput,
) -> Result<String, AppError> {
    campaigns::save_campaign(&database, campaign_id, input)
}
#[tauri::command]
fn list_campaigns(
    database: State<'_, Database>,
    client_id: Option<String>,
    status: Option<String>,
) -> Result<Vec<CampaignRecord>, AppError> {
    campaigns::list_campaigns(&database, client_id, status)
}
#[tauri::command]
fn get_campaign(
    database: State<'_, Database>,
    campaign_id: String,
) -> Result<CampaignRecord, AppError> {
    campaigns::get_campaign(&database, &campaign_id)
}
#[tauri::command]
fn archive_campaign(database: State<'_, Database>, campaign_id: String) -> Result<(), AppError> {
    campaigns::archive_campaign(&database, &campaign_id)
}
#[tauri::command]
fn save_content_plan(
    database: State<'_, Database>,
    input: ContentPlanInput,
) -> Result<String, AppError> {
    campaigns::save_content_plan(&database, input)
}
#[tauri::command]
fn list_content_plans(
    database: State<'_, Database>,
    client_id: Option<String>,
) -> Result<Vec<ContentPlanRecord>, AppError> {
    campaigns::list_content_plans(&database, client_id)
}
#[tauri::command]
fn universal_search(
    database: State<'_, Database>,
    query: String,
) -> Result<Vec<SearchResult>, AppError> {
    workspace::universal_search(&database, &query)
}
#[tauri::command]
fn list_activity(
    database: State<'_, Database>,
    client_id: Option<String>,
    action: Option<String>,
    limit: i64,
) -> Result<Vec<ActivityRecord>, AppError> {
    workspace::list_activity(&database, client_id, action, limit)
}
#[tauri::command]
fn list_settings(database: State<'_, Database>) -> Result<Vec<SettingRecord>, AppError> {
    workspace::list_settings(&database)
}
#[tauri::command]
fn update_setting(
    database: State<'_, Database>,
    key: String,
    value: serde_json::Value,
) -> Result<(), AppError> {
    workspace::update_setting(&database, &key, value)
}
#[tauri::command]
fn create_backup(
    database: State<'_, Database>,
    kind: String,
    destination: Option<String>,
) -> Result<BackupRecord, AppError> {
    workspace::create_backup(&database, &kind, destination)
}
#[tauri::command]
fn list_backups(database: State<'_, Database>) -> Result<Vec<BackupRecord>, AppError> {
    workspace::list_backups(&database)
}
#[tauri::command]
fn request_restore(database: State<'_, Database>, backup_path: String) -> Result<String, AppError> {
    workspace::request_restore(&database, &backup_path)
}

#[tauri::command]
fn get_security_status() -> SecurityStatus {
    security::status()
}

#[tauri::command]
fn get_release_readiness(database: State<'_, Database>) -> Result<ReleaseReadiness, AppError> {
    readiness::audit(&database, &std::env::current_exe()?)
}

#[tauri::command]
fn export_release_readiness(database: State<'_, Database>) -> Result<String, AppError> {
    readiness::export(&database, &std::env::current_exe()?)
}

#[tauri::command]
fn get_local_ai_status() -> LocalAiStatus {
    local_ai::status()
}

#[tauri::command]
fn generate_with_local_ai(model: String, prompt: String) -> Result<LocalAiResult, AppError> {
    local_ai::generate(&model, &prompt)
}

#[tauri::command]
fn get_background_scheduler_status(
    app: tauri::AppHandle,
) -> Result<BackgroundSchedulerStatus, AppError> {
    let home = app
        .path()
        .home_dir()
        .map_err(|_| AppError::AppDataDirectoryUnavailable)?;
    let executable = std::env::current_exe()?;
    background::status(&home, &executable)
}

#[tauri::command]
fn set_background_scheduler_enabled(
    app: tauri::AppHandle,
    enabled: bool,
) -> Result<BackgroundSchedulerStatus, AppError> {
    let home = app
        .path()
        .home_dir()
        .map_err(|_| AppError::AppDataDirectoryUnavailable)?;
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|_| AppError::AppDataDirectoryUnavailable)?;
    let executable = std::env::current_exe()?;
    background::set_enabled(&home, &app_data, &executable, enabled)
}

pub fn run_scheduler_once(database_path: PathBuf) -> Result<usize, String> {
    let database = Database::open(&database_path).map_err(|error| error.to_string())?;
    automation::tick(&database).map_err(|error| error.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(chatgpt::CodexRuntime::default())
        .setup(|app| {
            let app_data_dir: PathBuf = app.path().app_data_dir()?;
            workspace::apply_pending_restore(&app_data_dir)
                .map_err(Box::<dyn std::error::Error>::from)?;
            let database = Database::open(&app_data_dir.join("socialflow.sqlite"))
                .map_err(Box::<dyn std::error::Error>::from)?;
            automation::start_worker(app_data_dir.join("socialflow.sqlite"));
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            initialize_application,
            get_codex_status,
            start_codex_login,
            logout_codex,
            generate_with_codex,
            get_dashboard_summary,
            list_clients,
            get_client,
            create_client,
            update_client,
            archive_client,
            restore_client,
            delete_client,
            upload_client_logo,
            list_ai_campaign_options,
            save_ai_prompt,
            list_ai_prompt_history,
            mark_ai_prompt_copied,
            check_import_duplicates,
            save_content_import,
            list_posts,
            get_post,
            save_post,
            duplicate_post,
            submit_post_for_review,
            delete_draft_post,
            upload_media,
            list_media,
            rename_media,
            delete_media,
            list_attached_media_ids,
            attach_media,
            detach_media,
            list_approval_queue,
            approve_post,
            reject_post,
            list_calendar_items,
            list_schedulable_posts,
            schedule_post,
            reschedule_post,
            unschedule_post,
            run_scheduler_now,
            list_publishing_queue,
            retry_queue_item,
            cancel_queue_item,
            publish_now,
            list_notifications,
            mark_notification_read,
            list_social_accounts,
            connect_mock_account,
            list_social_oauth_configurations,
            connect_social_account_with_browser,
            validate_social_account,
            disconnect_account,
            set_mock_failure,
            collect_mock_analytics,
            collect_official_analytics,
            get_analytics_dashboard,
            build_analytics_prompt,
            import_ai_recommendations,
            list_ai_recommendations,
            create_report,
            list_reports,
            export_report,
            save_campaign,
            list_campaigns,
            get_campaign,
            archive_campaign,
            save_content_plan,
            list_content_plans,
            universal_search,
            list_activity,
            list_settings,
            update_setting,
            create_backup,
            list_backups,
            request_restore,
            get_local_ai_status,
            generate_with_local_ai,
            get_security_status,
            get_release_readiness,
            export_release_readiness,
            get_background_scheduler_status,
            set_background_scheduler_enabled
        ])
        .run(tauri::generate_context!())
        .expect("error while running SocialFlow OS");
}
