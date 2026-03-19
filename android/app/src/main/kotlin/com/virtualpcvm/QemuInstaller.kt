package com.virtualpcvm

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.apache.commons.compress.archivers.ar.ArArchiveInputStream
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.xz.XZCompressorInputStream
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

private const val TAG = "QemuInstaller"

/**
 * Termux APT repository constants.
 * Packages are compiled for aarch64 (ARM64) — the host Android architecture.
 */
private const val REPO_BASE   = "https://packages.termux.dev/apt/termux-main"
private const val PACKAGES_URL = "$REPO_BASE/dists/stable/main/binary-aarch64/Packages"

/** Termux QEMU package names → output binary name */
private val QEMU_PACKAGES = mapOf(
    "qemu-system-x86-64"  to "qemu-system-x86_64",
    "qemu-system-aarch64" to "qemu-system-aarch64",
    "qemu-system-arm"     to "qemu-system-arm",
    "qemu-system-i386"    to "qemu-system-i386",
)

data class InstallProgress(
    val step: String,
    val percent: Int,
    val log: String = "",
    val isDone: Boolean = false,
    val error: String? = null,
)

typealias ProgressCallback = (InstallProgress) -> Unit

object QemuInstaller {

    fun qemuDir(ctx: Context): File =
        File(ctx.filesDir, "qemu-bins").also { it.mkdirs() }

    fun isInstalled(ctx: Context, binaryName: String): Boolean =
        File(qemuDir(ctx), binaryName).canExecute()

    fun anyInstalled(ctx: Context): Boolean =
        QEMU_PACKAGES.values.any { isInstalled(ctx, it) }

    /* ══════════════════════════════════════════════════════════════
       Main entry-point: download + extract every QEMU package
       ══════════════════════════════════════════════════════════════ */
    suspend fun install(ctx: Context, onProgress: ProgressCallback) = withContext(Dispatchers.IO) {
        val dir = qemuDir(ctx)
        val tmpDir = File(ctx.cacheDir, "qemu-tmp").also { it.mkdirs() }

        try {
            // Step 1 — fetch Packages index
            onProgress(InstallProgress("Получение списка пакетов Termux...", 2,
                "GET $PACKAGES_URL"))
            val packagesText = fetchText(PACKAGES_URL)
            onProgress(InstallProgress("Список пакетов получен", 5,
                "Размер индекса: ${packagesText.length} байт"))

            val totalPackages = QEMU_PACKAGES.size
            QEMU_PACKAGES.entries.forEachIndexed { idx, (pkgName, binName) ->

                val basePercent = 5 + idx * (90 / totalPackages)

                // already installed?
                if (File(dir, binName).canExecute()) {
                    onProgress(InstallProgress("$binName уже установлен, пропуск", basePercent + 5,
                        "✓ $binName"))
                    return@forEachIndexed
                }

                // Step 2 — parse Packages to find Filename
                onProgress(InstallProgress("Поиск пакета $pkgName...", basePercent + 2,
                    "Парсинг индекса APT..."))
                val filename = parsePackageFilename(packagesText, pkgName)
                    ?: run {
                        onProgress(InstallProgress("Пакет $pkgName не найден в репозитории",
                            basePercent + 2, "⚠ Пропуск $pkgName", error = "not found"))
                        return@forEachIndexed
                    }

                val debUrl = "$REPO_BASE/$filename"
                onProgress(InstallProgress("Загрузка $pkgName...", basePercent + 3,
                    "↓ $debUrl"))

                // Step 3 — download .deb
                val debFile = File(tmpDir, "$pkgName.deb")
                downloadFile(debUrl, debFile) { downloaded, total ->
                    val pct = if (total > 0) (downloaded * 100 / total).toInt() else 0
                    val mb  = downloaded / 1_048_576f
                    onProgress(InstallProgress(
                        "Загрузка $pkgName... $pct%",
                        basePercent + 3 + (pct * (85 / totalPackages) / 100),
                        "↓ ${"%.1f".format(mb)} МБ  ($pct%)"
                    ))
                }
                onProgress(InstallProgress("Загрузка завершена, распаковка $pkgName...",
                    basePercent + (85 / totalPackages), "✓ ${debFile.length() / 1024} КБ"))

                // Step 4 — extract .deb → binary
                val extracted = extractDebBinary(debFile, dir, binName)
                debFile.delete()

                if (extracted) {
                    File(dir, binName).setExecutable(true, false)
                    onProgress(InstallProgress("chmod +x $binName", basePercent + (88 / totalPackages),
                        "✓ chmod +x ${dir.absolutePath}/$binName"))
                } else {
                    onProgress(InstallProgress("Не удалось найти $binName в .deb",
                        basePercent + (88 / totalPackages), "⚠ $binName не найден", error = "extract failed"))
                }
            }

            // Step 5 — verify
            onProgress(InstallProgress("Верификация установленных бинарников...", 97))
            val results = StringBuilder()
            QEMU_PACKAGES.values.forEach { bin ->
                val f = File(dir, bin)
                results.appendLine(if (f.canExecute()) "✓ $bin" else "✗ $bin (отсутствует)")
            }
            onProgress(InstallProgress("Установка завершена!", 100,
                results.toString(), isDone = true))

        } catch (e: Exception) {
            Log.e(TAG, "Install error", e)
            onProgress(InstallProgress("Ошибка установки", 0, e.message ?: "Неизвестная ошибка",
                error = e.message))
        } finally {
            tmpDir.deleteRecursively()
        }
    }

    /* ══════════════════════════════════════════════════════════════
       Parse the APT Packages index to find Filename: for a package
       ══════════════════════════════════════════════════════════════ */
    private fun parsePackageFilename(packagesText: String, pkgName: String): String? {
        var inBlock = false
        for (line in packagesText.lineSequence()) {
            when {
                line.startsWith("Package: ") -> inBlock = line.removePrefix("Package: ").trim() == pkgName
                inBlock && line.startsWith("Filename: ") -> return line.removePrefix("Filename: ").trim()
                line.isBlank() -> inBlock = false
            }
        }
        return null
    }

    /* ══════════════════════════════════════════════════════════════
       Download a URL to a file, reporting progress
       ══════════════════════════════════════════════════════════════ */
    private fun downloadFile(
        urlStr: String,
        dest: File,
        onProgress: (downloaded: Long, total: Long) -> Unit,
    ) {
        var conn: HttpURLConnection? = null
        try {
            conn = followRedirects(urlStr)
            val total = conn.contentLengthLong
            BufferedInputStream(conn.inputStream).use { input ->
                FileOutputStream(dest).use { output ->
                    val buf = ByteArray(65_536)
                    var downloaded = 0L
                    var read: Int
                    while (input.read(buf).also { read = it } != -1) {
                        output.write(buf, 0, read)
                        downloaded += read
                        onProgress(downloaded, total)
                    }
                }
            }
        } finally {
            conn?.disconnect()
        }
    }

    private fun followRedirects(urlStr: String): HttpURLConnection {
        var url = urlStr
        repeat(5) {
            val conn = URL(url).openConnection() as HttpURLConnection
            conn.instanceFollowRedirects = false
            conn.connectTimeout = 15_000
            conn.readTimeout    = 60_000
            conn.setRequestProperty("User-Agent", "VirtualPCVM/1.0 (Android)")
            val code = conn.responseCode
            if (code in 301..308) {
                url = conn.getHeaderField("Location") ?: throw Exception("Redirect без Location")
                conn.disconnect()
            } else {
                return conn
            }
        }
        throw Exception("Слишком много редиректов: $urlStr")
    }

    private fun fetchText(urlStr: String): String {
        val conn = followRedirects(urlStr)
        return try {
            conn.inputStream.bufferedReader().readText()
        } finally {
            conn.disconnect()
        }
    }

    /* ══════════════════════════════════════════════════════════════
       Extract the named binary from a .deb file (ar → data.tar.xz → binary)
       .deb = ar archive containing:
         debian-binary
         control.tar.xz
         data.tar.xz   ← we want this
       ══════════════════════════════════════════════════════════════ */
    private fun extractDebBinary(debFile: File, outDir: File, targetBinary: String): Boolean {
        Log.d(TAG, "Extracting $debFile for binary: $targetBinary")
        var found = false

        ArArchiveInputStream(debFile.inputStream().buffered()).use { ar ->
            var arEntry = ar.nextArEntry
            while (arEntry != null) {
                Log.d(TAG, "ar entry: ${arEntry.name}")
                if (arEntry.name.startsWith("data.tar")) {
                    found = extractTarBinary(ar, arEntry.name, outDir, targetBinary)
                    break
                }
                arEntry = ar.nextArEntry
            }
        }

        return found
    }

    private fun extractTarBinary(
        arStream: ArArchiveInputStream,
        entryName: String,
        outDir: File,
        targetBinary: String,
    ): Boolean {
        val decompressed = when {
            entryName.endsWith(".xz")  -> XZCompressorInputStream(arStream)
            entryName.endsWith(".gz")  -> java.util.zip.GZIPInputStream(arStream)
            entryName.endsWith(".zst") -> throw UnsupportedOperationException("zstd не поддерживается")
            else                       -> arStream // plain tar
        }

        TarArchiveInputStream(decompressed).use { tar ->
            var entry = tar.nextTarEntry
            while (entry != null) {
                // Termux stores binaries under ./data/data/com.termux/files/usr/bin/
                // or ./usr/bin/   — match by filename
                val name = File(entry.name).name
                if (!entry.isDirectory && (name == targetBinary || name.startsWith("qemu-system"))) {
                    val dest = File(outDir, name)
                    Log.i(TAG, "Extracting $name → $dest")
                    dest.outputStream().use { out ->
                        val buf = ByteArray(65_536)
                        var read: Int
                        while (tar.read(buf).also { read = it } != -1) {
                            out.write(buf, 0, read)
                        }
                    }
                    if (name == targetBinary) return true
                }
                entry = tar.nextTarEntry
            }
        }
        return File(outDir, targetBinary).exists()
    }
}
