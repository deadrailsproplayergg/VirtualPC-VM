package com.virtualpcvm

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.virtualpcvm.databinding.ActivityMainBinding
import com.virtualpcvm.databinding.ItemVmCardBinding
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    private val vms = mutableListOf(
        VmConfig(
            name = "Android x86_64",
            architecture = Architecture.X86_64,
            machineType = MachineType.Q35,
            ramMb = 2048, cpuCores = 2,
            isoPath = "/storage/emulated/0/MyVMs/android.iso",
            enableAudio = true,
        ),
        VmConfig(
            name = "Linux Lite (ARM64)",
            architecture = Architecture.ARM64,
            machineType = MachineType.VIRT,
            ramMb = 1024, cpuCores = 2,
            enableAudio = true,
        ),
        VmConfig(
            name = "Windows XP (i386)",
            architecture = Architecture.I386,
            machineType = MachineType.PC,
            ramMb = 512, cpuCores = 1,
            isoPath = "/storage/emulated/0/MyVMs/winxp.iso",
            enableAudio = true,
        ),
    )

    private lateinit var adapter: VmAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setSupportActionBar(binding.toolbar)

        adapter = VmAdapter(
            items   = vms,
            onStart = { cfg -> launchVm(cfg) },
            onEdit  = { cfg -> showEditDialog(cfg) },
            onStop  = { cfg ->
                QemuManager.stop(cfg.id)
                Toast.makeText(this, "ВМ «${cfg.name}» остановлена", Toast.LENGTH_SHORT).show()
                adapter.notifyDataSetChanged()
            }
        )
        binding.recyclerVms.layoutManager = LinearLayoutManager(this)
        binding.recyclerVms.adapter = adapter

        binding.fabAddVm.setOnClickListener { showCreateDialog() }

        refreshQemuBanner()
    }

    override fun onResume() {
        super.onResume()
        refreshQemuBanner()
    }

    /* ── QEMU status banner ── */
    private fun refreshQemuBanner() {
        val installed = QemuInstaller.anyInstalled(this)
        binding.bannerQemu.apply {
            android.view.View.VISIBLE.also { visibility = it }
            if (installed) {
                text = "✓ QEMU установлен — нажмите «Старт ВМ» для запуска"
                setBackgroundColor(0xFF1B5E20.toInt())
            } else {
                text = "⚠ QEMU не найден — нажмите здесь для установки"
                setBackgroundColor(0xFFE65100.toInt())
                setOnClickListener {
                    startActivity(Intent(this@MainActivity, InstallActivity::class.java))
                }
            }
            setTextColor(0xFFFFFFFF.toInt())
        }
    }

    /* ── launch VM → wait for VNC → open VNCActivity ── */
    private fun launchVm(cfg: VmConfig) {
        // pre-flight check
        val bin = QemuManager.findBinary(this, cfg.architecture)
        if (bin == null) {
            MaterialAlertDialogBuilder(this)
                .setTitle("QEMU не установлен")
                .setMessage("Бинарник для архитектуры «${cfg.architecture.label}» не найден.\n\nОткрыть экран установки?")
                .setPositiveButton("Установить") { _, _ ->
                    startActivity(Intent(this, InstallActivity::class.java))
                }
                .setNegativeButton("Отмена", null)
                .show()
            return
        }

        val logLines = StringBuilder()
        val progressDialog = MaterialAlertDialogBuilder(this)
            .setTitle("Запуск ВМ «${cfg.name}»")
            .setMessage("Ожидание QEMU...")
            .setCancelable(false)
            .create()
        progressDialog.show()

        lifecycleScope.launch {
            try {
                // 1. spawn QEMU process
                QemuManager.start(this@MainActivity, cfg) { line ->
                    logLines.appendLine(line)
                    runOnUiThread { progressDialog.setMessage(line.take(90)) }
                }

                // 2. wait up to 8 s for VNC port to open
                progressDialog.setMessage("Ожидание VNC на порту ${cfg.vncPort}...")
                val vncReady = QemuManager.waitForVnc(port = cfg.vncPort, timeoutMs = 8_000)
                progressDialog.dismiss()

                if (!vncReady) {
                    MaterialAlertDialogBuilder(this@MainActivity)
                        .setTitle("VNC недоступен")
                        .setMessage("QEMU запущен, но VNC не ответил.\n\nЛог:\n${logLines.takeLast(1000)}")
                        .setPositiveButton("OK", null)
                        .setNegativeButton("Всё равно открыть VNC") { _, _ -> openVnc(cfg) }
                        .show()
                    return@launch
                }

                // 3. open VNC screen
                openVnc(cfg)

            } catch (e: Exception) {
                progressDialog.dismiss()
                MaterialAlertDialogBuilder(this@MainActivity)
                    .setTitle("Ошибка запуска")
                    .setMessage(e.message ?: "Неизвестная ошибка")
                    .setPositiveButton("OK", null)
                    .show()
            }
        }
    }

    private fun openVnc(cfg: VmConfig) {
        startActivity(Intent(this, VNCActivity::class.java).apply {
            putExtra(VNCActivity.EXTRA_HOST,    "127.0.0.1")
            putExtra(VNCActivity.EXTRA_PORT,    cfg.vncPort)
            putExtra(VNCActivity.EXTRA_VM_NAME, cfg.name)
            putExtra(VNCActivity.EXTRA_VM_ID,   cfg.id)
        })
    }

    /* ── VM form dialogs ── */
    private fun showCreateDialog() {
        showVmDialog(VmConfig()) { newCfg ->
            vms.add(newCfg); adapter.notifyItemInserted(vms.lastIndex)
        }
    }

    private fun showEditDialog(cfg: VmConfig) {
        val idx = vms.indexOf(cfg)
        showVmDialog(cfg) { updated ->
            if (idx >= 0) { vms[idx] = updated; adapter.notifyItemChanged(idx) }
        }
    }

    private fun showVmDialog(initial: VmConfig, onSave: (VmConfig) -> Unit) {
        val view     = layoutInflater.inflate(R.layout.dialog_vm_form, null)
        val etName   = view.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.etName)
        val etRam    = view.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.etRam)
        val etCpu    = view.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.etCpu)
        val etDisk   = view.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.etDisk)
        val etIso    = view.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.etIso)
        val spinArch = view.findViewById<android.widget.Spinner>(R.id.spinArch)
        val spinMach = view.findViewById<android.widget.Spinner>(R.id.spinMachine)

        etName.setText(initial.name)
        etRam.setText(initial.ramMb.toString())
        etCpu.setText(initial.cpuCores.toString())
        etDisk.setText(initial.diskPath)
        etIso.setText(initial.isoPath)

        val archValues = Architecture.values()
        spinArch.adapter = android.widget.ArrayAdapter(this,
            android.R.layout.simple_spinner_dropdown_item, archValues.map { it.label })
        spinArch.setSelection(archValues.indexOf(initial.architecture).coerceAtLeast(0))

        val machValues = MachineType.values()
        spinMach.adapter = android.widget.ArrayAdapter(this,
            android.R.layout.simple_spinner_dropdown_item, machValues.map { it.value })
        spinMach.setSelection(machValues.indexOf(initial.machineType).coerceAtLeast(0))

        MaterialAlertDialogBuilder(this)
            .setTitle(if (initial.id == 0L) "Новая ВМ" else "Редактировать «${initial.name}»")
            .setView(view)
            .setPositiveButton("Сохранить") { _, _ ->
                onSave(initial.copy(
                    name         = etName.text.toString().ifBlank { "ВМ" },
                    ramMb        = etRam.text.toString().toIntOrNull() ?: 1024,
                    cpuCores     = etCpu.text.toString().toIntOrNull() ?: 2,
                    diskPath     = etDisk.text.toString(),
                    isoPath      = etIso.text.toString(),
                    architecture = archValues[spinArch.selectedItemPosition],
                    machineType  = machValues[spinMach.selectedItemPosition],
                ))
            }
            .setNegativeButton("Отмена", null)
            .show()
    }
}

/* ── RecyclerView Adapter ── */
class VmAdapter(
    private val items: List<VmConfig>,
    private val onStart: (VmConfig) -> Unit,
    private val onEdit:  (VmConfig) -> Unit,
    private val onStop:  (VmConfig) -> Unit,
) : RecyclerView.Adapter<VmAdapter.VH>() {

    inner class VH(val b: ItemVmCardBinding) : RecyclerView.ViewHolder(b.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemVmCardBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun getItemCount() = items.size

    override fun onBindViewHolder(holder: VH, pos: Int) {
        val cfg     = items[pos]
        val running = QemuManager.isRunning(cfg.id)
        holder.b.apply {
            tvVmName.text = cfg.name
            tvVmInfo.text = buildString {
                append("${cfg.architecture.label} · ${cfg.ramMb} MB · ${cfg.cpuCores} ядер")
                if (cfg.enableAudio) append(" · 🔊")
            }
            tvVmArch.text   = cfg.machineType.value
            chipStatus.text = if (running) "Запущена" else "Остановлена"
            chipStatus.setChipBackgroundColorResource(
                if (running) R.color.chip_running else R.color.chip_stopped)
            btnStart.isEnabled = !running
            btnStop.isEnabled  = running
            btnStart.setOnClickListener { onStart(cfg) }
            btnStop.setOnClickListener  { onStop(cfg)  }
            root.setOnLongClickListener { onEdit(cfg); true }
        }
    }
}
