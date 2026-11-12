plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The app's screens are the same web files the iPhone app uses (App/web).
// This task copies them into the APK's assets as "web/" at build time.
abstract class CopyWebAssets : DefaultTask() {
    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val source: DirectoryProperty

    @get:OutputDirectory
    abstract val output: DirectoryProperty

    @TaskAction
    fun copy() {
        val out = output.get().asFile
        out.deleteRecursively()
        source.get().asFile.copyRecursively(out.resolve("web"), overwrite = true)
    }
}

val copyWebAssets = tasks.register<CopyWebAssets>("copyWebAssets") {
    source.set(layout.projectDirectory.dir("../../App/web"))
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(copyWebAssets, CopyWebAssets::output)
    }
}

// Release signing: CI passes the keystore via environment variables (from GitHub secrets).
// Without them the release APK is signed with the debug key so a build still comes out.
val keystoreFile: String? = System.getenv("ANDROID_KEYSTORE_FILE")
val keystorePassword: String? = System.getenv("ANDROID_KEYSTORE_PASSWORD")

android {
    namespace = "com.chordatlas.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.chordatlas.app"
        minSdk = 24
        targetSdk = 35
        versionCode = (System.getenv("VERSION_CODE") ?: "1").toInt()
        versionName = "1.0"
    }

    signingConfigs {
        create("release") {
            if (keystoreFile != null && keystorePassword != null) {
                storeFile = file(keystoreFile)
                storePassword = keystorePassword
                keyAlias = System.getenv("ANDROID_KEY_ALIAS") ?: "chordatlas"
                keyPassword = keystorePassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (keystoreFile != null && keystorePassword != null) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    lint {
        // Sideloaded app: don't fail the build on Play-Store policy checks.
        checkReleaseBuilds = false
        abortOnError = false
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.webkit:webkit:1.12.1")
}
