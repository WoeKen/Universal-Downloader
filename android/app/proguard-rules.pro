# Universal Downloader Android Proguard Rules
-keepattributes *Annotation*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.universal.downloader.** { *; }
