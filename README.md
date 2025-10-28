# AI-Friendly CDN Service

This repository stores static assets that are mirrored to [Bunny Storage](https://bunny.net/storage/) by a GitHub Actions workflow. Any file committed under the `users/` directory is uploaded to your Bunny Storage zone and becomes available through the configured pull zone (e.g. `https://g.zcxv.xyz`).

## 빠른 시작 (한글 안내)

1. **Bunny Storage 비밀값 등록**  
   GitHub 저장소 → **Settings → Secrets and variables → Actions** 로 이동하여 다음 항목을 추가합니다.  
   - `BUNNY_STORAGE_NAME`: Bunny Storage 존 이름 (예: `cdn-media`)  
   - `BUNNY_ACCESS_KEY`: Bunny Storage Access Key  
   - `BUNNY_STORAGE_ENDPOINT` (선택): 기본 엔드포인트(`https://storage.bunnycdn.com`)를 쓰면 생략 가능

2. **Bunny Pull Zone 점검**  
   Bunny 대시보드에서 Pull Zone을 열어 **Force Hostname**을 `g.zcxv.xyz`(또는 원하는 도메인)으로 설정하고, 필요하면 **Block direct access to the storage zone** 옵션을 켭니다.

3. **파일 준비 및 커밋**  
   `users/` 아래에 자신의 폴더(예: `users/you/`)를 만들고 업로드할 이미지·파일을 넣은 뒤 `main` 브랜치에 커밋/푸시합니다.

4. **GitHub Actions 결과 확인**  
   푸시가 끝나면 Actions 탭에서 `Deploy to Bunny Storage` 워크플로 실행 내역을 확인합니다. 성공하면 파일이 Bunny Storage에 동기화됩니다.

5. **배포된 파일 접근**  
   Pull Zone 도메인을 기준으로 `https://g.zcxv.xyz/users/<내 폴더>/<파일 경로>` 형태의 URL로 바로 접근할 수 있습니다. (예: `https://g.zcxv.xyz/users/you/test/a/1.webp`)

6. **(선택) 로컬에서 즉시 동기화**  
   CI를 기다리지 않고 바로 업로드하고 싶다면 아래의 "Optional: sync manually from your machine" 절차를 따라 `scripts/sync-to-bunny.sh`를 실행합니다.

필요한 작업은 위 단계만 수행하면 끝입니다. 추가적인 코드 수정은 필요하지 않습니다.

## Prerequisites

Set the following repository secrets (Settings → Secrets and variables → Actions):

| Secret | Description |
| ------ | ----------- |
| `BUNNY_STORAGE_NAME` | The name of the Bunny Storage zone (e.g. `cdn-media`). |
| `BUNNY_ACCESS_KEY` | The Bunny Storage Access Key. |
| `BUNNY_STORAGE_ENDPOINT` (optional) | Custom storage endpoint. Defaults to `https://storage.bunnycdn.com`. |

> ℹ️  Make sure your Bunny pull zone is configured to force the hostname you intend to use (e.g. `g.zcxv.xyz`) and to block direct access to the storage zone if desired.

## Adding files

1. Create a personal folder in `users/` (for example, `users/you/`).
2. Add or update files inside that folder.
3. Commit and push the changes to the `main` branch.

The GitHub Actions workflow (`.github/workflows/deploy.yml`) runs automatically on every push to `main` that touches `users/**`. You can also trigger it manually from the Actions tab with **Run workflow**.

## How the sync works

The workflow uses `rclone` to synchronize `./users` with your Bunny Storage zone using the secrets above. It copies files, updates existing ones, and removes files that are deleted from the repository so that storage stays in sync with the Git history.

## Accessing your files

Assets uploaded by the workflow are served from your Bunny pull zone. The general URL pattern is:

```
https://g.zcxv.xyz/users/<your-folder>/<path-to-file>
```

For example, a file stored at `users/you/test/a/1.webp` is available at:

```
https://g.zcxv.xyz/users/you/test/a/1.webp
```

Replace `g.zcxv.xyz` with your own hostname if you have configured a different pull zone domain.

## Optional: sync manually from your machine

If you want to upload assets without waiting for GitHub Actions, use `scripts/sync-to-bunny.sh`. The script mirrors the workflow configuration locally via `rclone`.

1. [Install `rclone`](https://rclone.org/install/) if it is not already available on your machine.
2. Export the same environment variables you configured as repository secrets:

   ```bash
   export BUNNY_STORAGE_NAME="cdn-media"
   export BUNNY_ACCESS_KEY="<your-access-key>"
   # Optional override:
   # export BUNNY_STORAGE_ENDPOINT="https://storage.bunnycdn.com"
   ```

3. Run the script from the repository root:

   ```bash
   ./scripts/sync-to-bunny.sh
   ```

The script creates a temporary `rclone` configuration and performs the same sync command as the CI workflow, including cache-control headers and pruning of removed files.

## Tips

- Use `.gitignore` to avoid committing temporary or OS-specific files. This repository already ignores common macOS and Windows metadata files.
- Consider adding validation (file type, size limits, etc.) to the workflow if you need stricter control over uploads.
