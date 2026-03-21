export type Language = 'es' | 'en' | 'de';

export interface TranslationKeys {
    nav_tools: string;
    nav_calc: string;
    nav_gears: string;
    nav_cad: string;
    nav_works: string;
    hero_title: string;
    hero_desc: string;
    contact_title: string;
    contact_desc: string;
    input_email: string;
    input_msg: string;
    btn_send: string;
    footer_rights: string;
    footer_dev: string;
    work_tag: string;
    work_title: string;
    work_desc: string;
    work_btn: string;
    work2_tag: string;
    work2_title: string;
    work2_desc: string;
    // Auth Keys
    auth_login_title: string;
    auth_register_title: string;
    auth_email: string;
    auth_pass: string;
    auth_name: string;
    auth_admin_key: string;
    auth_btn_login: string;
    auth_btn_register: string;
    auth_switch_to_register: string;
    auth_switch_to_login: string;
    auth_admin_mode: string;
    auth_back_home: string;
    btn_access: string;
    nav_profile: string;
    nav_logout: string;
    auth_reg_success: string;
    crud_add: string;
    crud_edit: string;
    crud_delete: string;
    crud_confirm: string;
    welcome_user: string;
}

export interface Translations {
    es: TranslationKeys;
    en: TranslationKeys;
    de: TranslationKeys;
}