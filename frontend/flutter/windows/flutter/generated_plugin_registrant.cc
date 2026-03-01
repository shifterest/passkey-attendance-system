//
//  Generated file. Do not edit.
//

// clang-format off

#include "generated_plugin_registrant.h"

#include <app_links/app_links_plugin_c_api.h>
#include <flutter_blue_plus_winrt/flutter_blue_plus_plugin.h>
#include <passkeys_windows/passkeys_windows_plugin.h>

void RegisterPlugins(flutter::PluginRegistry* registry) {
  AppLinksPluginCApiRegisterWithRegistrar(
      registry->GetRegistrarForPlugin("AppLinksPluginCApi"));
  FlutterBluePlusPluginRegisterWithRegistrar(
      registry->GetRegistrarForPlugin("FlutterBluePlusPlugin"));
  PasskeysWindowsPluginRegisterWithRegistrar(
      registry->GetRegistrarForPlugin("PasskeysWindowsPlugin"));
}
