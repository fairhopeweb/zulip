import $ from "jquery";

import * as channel from "./channel";
import * as emojisets from "./emojisets";
import {$t_html, get_language_name} from "./i18n";
import * as loading from "./loading";
import * as overlays from "./overlays";
import * as settings_config from "./settings_config";
import * as settings_ui from "./settings_ui";
import * as ui_report from "./ui_report";
import {user_settings} from "./user_settings";

const meta = {
    loaded: false,
};

export let user_default_language_name;

export function set_default_language_name(name) {
    user_default_language_name = name;
}

function change_display_setting(data, container, url, status_element, success_msg_html, sticky) {
    const $status_el = container.find(`${status_element}`);
    const status_is_sticky = $status_el.data("is_sticky");
    const display_message_html = status_is_sticky
        ? $status_el.data("sticky_msg_html")
        : success_msg_html;
    const opts = {
        success_msg_html: display_message_html,
        sticky: status_is_sticky || sticky,
    };

    if (sticky) {
        $status_el.data("is_sticky", true);
        $status_el.data("sticky_msg_html", success_msg_html);
    }
    settings_ui.do_settings_change(channel.patch, url, data, $status_el, opts);
}

export function set_up(container, settings_object, for_realm_settings) {
    meta.loaded = true;
    let language_modal_elem = "#user_default_language_modal";
    let patch_url = "/json/settings";
    if (for_realm_settings) {
        language_modal_elem = "#realm_default_language_modal";
        patch_url = "/json/realm/user_settings_defaults";
    }

    container.find(".display-settings-status").hide();

    container.find(".setting_demote_inactive_streams").val(settings_object.demote_inactive_streams);

    container.find(".setting_color_scheme").val(settings_object.color_scheme);

    container.find(".setting_default_view").val(settings_object.default_view);

    container
        .find(".setting_twenty_four_hour_time")
        .val(JSON.stringify(settings_object.twenty_four_hour_time));

    container
        .find(`.setting_emojiset_choice[value="${CSS.escape(settings_object.emojiset)}"]`)
        .prop("checked", true);

    $(`${CSS.escape(language_modal_elem)} [data-dismiss]`).on("click", () => {
        overlays.close_modal(language_modal_elem);
    });

    const all_display_settings = settings_config.get_all_display_settings();
    for (const setting of all_display_settings.settings.user_display_settings) {
        container.find(`.${CSS.escape(setting)}`).on("change", function () {
            const data = {};
            data[setting] = JSON.stringify($(this).prop("checked"));

            if (["left_side_userlist"].includes(setting)) {
                change_display_setting(
                    data,
                    container,
                    patch_url,
                    ".display-settings-status",
                    $t_html(
                        {
                            defaultMessage:
                                "Saved. Please <z-link>reload</z-link> for the change to take effect.",
                        },
                        {"z-link": (content_html) => `<a class='reload_link'>${content_html}</a>`},
                    ),
                    true,
                );
            } else {
                change_display_setting(data, container, patch_url, ".display-settings-status");
            }
        });
    }

    if (!for_realm_settings) {
        $(language_modal_elem)
            .find(".language")
            .on("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                overlays.close_modal(language_modal_elem);

                const $link = $(e.target).closest("a[data-code]");
                const setting_value = $link.attr("data-code");
                const data = {default_language: setting_value};

                const new_language = $link.attr("data-name");
                container.find(".default_language_name").text(new_language);

                change_display_setting(
                    data,
                    container,
                    patch_url,
                    ".language-settings-status",
                    $t_html(
                        {
                            defaultMessage:
                                "Saved. Please <z-link>reload</z-link> for the change to take effect.",
                        },
                        {"z-link": (content_html) => `<a class='reload_link'>${content_html}</a>`},
                    ),
                    true,
                );
            });

        container.find(".setting_default_language").on("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            overlays.open_modal(language_modal_elem);
        });

        container.find(".setting_twenty_four_hour_time").on("change", function () {
            const data = {twenty_four_hour_time: this.value};
            change_display_setting(data, container, patch_url, ".time-settings-status");
        });
    }

    container.find(".setting_demote_inactive_streams").on("change", function () {
        const data = {demote_inactive_streams: this.value};
        change_display_setting(data, container, patch_url, ".display-settings-status");
    });

    container.find(".setting_color_scheme").on("change", function () {
        const data = {color_scheme: this.value};
        change_display_setting(data, container, patch_url, ".display-settings-status");
    });

    container.find(".setting_default_view").on("change", function () {
        const data = {default_view: this.value};
        change_display_setting(data, container, patch_url, ".display-settings-status");
    });

    $("body").on("click", ".reload_link", () => {
        window.location.reload();
    });

    container.find(".setting_emojiset_choice").on("click", function () {
        const data = {emojiset: $(this).val()};
        const current_emojiset = settings_object.emojiset;
        if (current_emojiset === data.emojiset) {
            return;
        }
        const spinner = container.find(".emoji-settings-status").expectOne();
        loading.make_indicator(spinner, {text: settings_ui.strings.saving});

        channel.patch({
            url: patch_url,
            data,
            success() {},
            error(xhr) {
                ui_report.error(
                    settings_ui.strings.failure_html,
                    xhr,
                    container.find(".emoji-settings-status").expectOne(),
                );
            },
        });
    });

    container.find(".translate_emoticons").on("change", function () {
        const data = {translate_emoticons: JSON.stringify(this.checked)};
        change_display_setting(data, container, patch_url, ".emoji-settings-status");
    });
}

export async function report_emojiset_change(container, settings_object) {
    // TODO: Clean up how this works so we can use
    // change_display_setting.  The challenge is that we don't want to
    // report success before the server_events request returns that
    // causes the actual sprite sheet to change.  The current
    // implementation is wrong, though, in that it displays the UI
    // update in all active browser windows.
    await emojisets.select(settings_object.emojiset);

    const spinner = container.find(".emoji-settings-status");
    if (spinner.length) {
        loading.destroy_indicator(spinner);
        ui_report.success(
            $t_html({defaultMessage: "Emoji set changed successfully!"}),
            spinner.expectOne(),
        );
        spinner.expectOne();
        settings_ui.display_checkmark(spinner);
    }
}

export function update_page(container, settings_object) {
    const default_language_name = user_default_language_name;

    container.find(".left_side_userlist").prop("checked", settings_object.left_side_userlist);
    container.find(".default_language_name").text(default_language_name);
    container.find(".translate_emoticons").prop("checked", settings_object.translate_emoticons);
    container
        .find(".setting_twenty_four_hour_time")
        .val(JSON.stringify(settings_object.twenty_four_hour_time));
    container.find(".setting_color_scheme").val(JSON.stringify(settings_object.color_scheme));
    container.find(".setting_default_view").val(settings_object.default_view);

    // TODO: Set emoji set selector here.
    // Longer term, we'll want to automate this function
}

export function initialize() {
    const user_language_name = get_language_name(user_settings.default_language);
    set_default_language_name(user_language_name);
}
