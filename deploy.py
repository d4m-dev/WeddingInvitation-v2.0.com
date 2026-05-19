#!/usr/bin/env python3
import subprocess
import sys
import time
import threading
import os
# python3 /root/WeddingInvitation.com/deploy.py
# --- MÀU SẮC ANSI GIAO DIỆN ---
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

# --- ANIMATION SPINNER ---
class Spinner:
    busy = False
    delay = 0.1
    
    @staticmethod
    def spinning_cursor():
        while True: 
            for cursor in '|/-\\': yield cursor
            
    def __init__(self, delay=None):
        self.spinner_generator = self.spinning_cursor()
        if delay and float(delay): self.delay = delay
        
    def spinner_task(self):
        while self.busy:
            sys.stdout.write(next(self.spinner_generator))
            sys.stdout.flush()
            time.sleep(self.delay)
            sys.stdout.write('\b')
            sys.stdout.flush()
            
    def __enter__(self):
        self.busy = True
        threading.Thread(target=self.spinner_task).start()
        
    def __exit__(self, exception, value, tb):
        self.busy = False
        time.sleep(self.delay)
        if exception is not None:
            return False

# --- HÀM TIỆN ÍCH ---
def run_cmd(cmd):
    """Chạy lệnh shell và trả về mã lỗi, stdout, stderr"""
    if isinstance(cmd, str):
        process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    else:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    stdout, stderr = process.communicate()
    return process.returncode, stdout, stderr

def log_info(msg):
    print(f"{Colors.CYAN}[*]{Colors.ENDC} {msg}")

def log_success(msg):
    print(f"{Colors.GREEN}[+]{Colors.ENDC} {msg}")

def log_error(msg):
    print(f"{Colors.FAIL}[-]{Colors.ENDC} {msg}")

def log_warning(msg):
    print(f"{Colors.WARNING}[!]{Colors.ENDC} {msg}")

def get_current_branch():
    code, out, err = run_cmd("git rev-parse --abbrev-ref HEAD")
    if code == 0:
        return out.strip()
    return "main"

# --- TÍNH NĂNG SMART COMMIT TỪNG FILE ---
def auto_commit_per_file():
    """Nhận diện từng file thay đổi và commit với message chuẩn (Pro Feature)"""
    log_info("Đang kiểm tra các file thay đổi...")
    
    # 1. Add toàn bộ để Git có thể nhận diện Rename (status R)
    run_cmd(["git", "add", "-A"])
    
    # 2. Lấy status với porcelain -z để tránh lỗi khoảng trắng/kí tự đặc biệt trong tên file
    code, out, err = run_cmd(["git", "status", "--porcelain", "-z"])
    if not out:
        log_info("Không có thay đổi nào để commit.")
        return 0
        
    # Phân tích danh sách thay đổi chuẩn xác
    entries = out.split('\x00')
    changes = []
    
    i = 0
    while i < len(entries):
        entry = entries[i]
        if not entry:
            i += 1
            continue
            
        status = entry[:2]
        file_path = entry[3:]
        
        if 'R' in status:
            # Trạng thái Rename trong porcelain -z: "XY new_file\0old_file\0"
            i += 1
            old_path = entries[i]
            changes.append(('R', old_path, file_path))
        elif 'A' in status or '?' in status:
            changes.append(('A', file_path, None))
        elif 'D' in status:
            changes.append(('D', file_path, None))
        else:
            # Modified hoặc các trạng thái khác
            changes.append(('M', file_path, None))
            
        i += 1
            
    # 3. Unstage toàn bộ để thực hiện commit tuần tự từng file
    run_cmd(["git", "reset"])
    
    # 4. Thực hiện add và commit từng file
    count = 0
    for change in changes:
        status, file1, file2 = change
        
        if status == 'R':
            # Rename cần add file cũ (để ghi nhận xóa) và file mới (thêm mới)
            run_cmd(["git", "add", "-A", "--", file1, file2])
            msg = f"Rename from [{file1}] to [{file2}]"
        elif status == 'A':
            run_cmd(["git", "add", "-A", "--", file1])
            msg = f"Create [{file1}]"
        elif status == 'D':
            run_cmd(["git", "add", "-A", "--", file1])
            msg = f"Delete [{file1}]"
        else:
            run_cmd(["git", "add", "-A", "--", file1])
            msg = f"Update [{file1}]"
            
        # Thực thi Commit
        code, out, err = run_cmd(["git", "commit", "-m", msg])
        if code == 0:
            log_success(f"Committed: {Colors.CYAN}{msg}{Colors.ENDC}")
            count += 1
            
    return count

# --- LOGIC DEPLOY CHÍNH ---
def deploy():
    os.system('clear')
    print(f"{Colors.HEADER}{Colors.BOLD}")
    print("========================================================")
    print(" 🚀 SMART AUTO-DEPLOY SCRIPT - WEDDING INVITATION")
    print("========================================================")
    print(f"{Colors.ENDC}")

    repo_url = "git@github.com:d4m-dev/WeddingInvitation-v2.0.com.git"
    
    # 1. Kiểm tra Git Init
    if not os.path.exists(".git"):
        log_info("Khởi tạo kho lưu trữ Git...")
        run_cmd("git init")
        log_success("Git đã được khởi tạo.")
        
    # 2. Cấu hình Remote
    log_info("Đang cấu hình remote repository...")
    code, out, err = run_cmd("git remote -v")
    if "origin" not in out:
        run_cmd(["git", "remote", "add", "origin", repo_url])
    else:
        run_cmd(["git", "remote", "set-url", "origin", repo_url])
    log_success(f"Remote đã được cấu hình: {Colors.CYAN}{repo_url}{Colors.ENDC}")

    # Lấy nhánh hiện tại
    branch = get_current_branch()
    if branch == "HEAD":
        branch = "main"
        run_cmd(["git", "checkout", "-b", "main"])

    log_info(f"Nhánh hiện tại: {Colors.BOLD}{branch}{Colors.ENDC}")

    # 3. SMART COMMIT THEO TỪNG FILE
    print(f"\n{Colors.CYAN}[*]{Colors.ENDC} Đang tiến hành xử lý Git Commit tự động và độc lập...")
    commits_made = auto_commit_per_file()
    
    if commits_made == 0:
        log_warning("Chưa có thay đổi mới nào (Working tree clean).")
    else:
        print(f"{Colors.GREEN}Đã tạo thành công {commits_made} commit(s) độc lập!{Colors.ENDC}")

    # 4. VÒNG LẶP PUSH THÔNG MINH
    print(f"\n{Colors.CYAN}[*]{Colors.ENDC} Đang bắt đầu quá trình đồng bộ (Push)...")
    max_attempts = 4
    attempt = 1
    success = False
    force_pushed = False

    while attempt <= max_attempts and not success:
        log_info(f"Đang đẩy code lên GitHub (Thử lần {attempt}/{max_attempts})...")
        
        sys.stdout.write(f"    Pushing... ")
        sys.stdout.flush()
        
        with Spinner():
            if force_pushed:
                push_cmd = ["git", "push", "origin", branch, "--force"]
            else:
                push_cmd = ["git", "push", "origin", branch]
            code, out, err = run_cmd(push_cmd)
        
        if code == 0:
            print(f"{Colors.GREEN}Thành công!{Colors.ENDC}")
            success = True
            break
        
        print(f"{Colors.FAIL}Thất bại!{Colors.ENDC}")
        error_output = err.lower()
        
        # --- PHÂN TÍCH LỖI VÀ TỰ ĐỘNG SỬA ---
        if "set-upstream" in error_output or "no upstream branch" in error_output:
            log_warning("Chưa có nhánh upstream. Đang tự động thiết lập upstream...")
            run_cmd(["git", "push", "--set-upstream", "origin", branch])
            success = True
            
        elif "fetch first" in error_output or "non-fast-forward" in error_output:
            log_warning("Remote có code mới hơn. Đang tự động Pull (Rebase)...")
            sys.stdout.write(f"    Pulling... ")
            sys.stdout.flush()
            with Spinner():
                pull_code, pull_out, pull_err = run_cmd(["git", "pull", "origin", branch, "--rebase"])
            
            if pull_code != 0:
                print(f"{Colors.FAIL}Thất bại!{Colors.ENDC}")
                if "unrelated histories" in pull_err.lower():
                    log_warning("Lịch sử commit không liên quan. Đang tự động merge...")
                    run_cmd(["git", "pull", "origin", branch, "--allow-unrelated-histories", "--no-edit"])
                elif "conflict" in pull_err.lower():
                    log_error("Xảy ra xung đột mã (Merge Conflict)!")
                    log_warning("Hủy Rebase và sử dụng Force Push để ưu tiên mã local...")
                    run_cmd(["git", "rebase", "--abort"])
                    force_pushed = True
                else:
                    force_pushed = True
            else:
                print(f"{Colors.GREEN}Xong!{Colors.ENDC}")
                
        elif "permission denied" in error_output or "could not read from remote" in error_output:
            log_error("Từ chối quyền truy cập SSH (Permission Denied)!")
            log_info("Vui lòng kiểm tra lại SSH Key của GitHub.")
            log_info("Bạn có thể chạy: eval $(ssh-agent -s) && ssh-add ~/.ssh/id_rsa")
            break
            
        else:
            log_warning("Lỗi không xác định. Đang tự động dùng Force Push làm phương án cuối...")
            print(f"{Colors.WARNING}Chi tiết lỗi: {err.strip()}{Colors.ENDC}")
            force_pushed = True
        
        attempt += 1
        time.sleep(1)

    print("\n" + "=" * 56)
    if success:
        print(f"{Colors.BOLD}{Colors.GREEN} 🎉 DEPLOYMENT THÀNH CÔNG! CODE ĐÃ ĐƯỢC ĐẨY LÊN GITHUB. 🎉{Colors.ENDC}")
    else:
        print(f"{Colors.BOLD}{Colors.FAIL} ❌ DEPLOYMENT THẤT BẠI SAU {max_attempts} LẦN THỬ.{Colors.ENDC}")
    print("========================================================")

if __name__ == '__main__':
    try:
        deploy()
    except KeyboardInterrupt:
        print(f"\n{Colors.WARNING}Đã hủy quá trình deploy.{Colors.ENDC}")
        sys.exit(0)