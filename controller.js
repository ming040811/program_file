document.addEventListener('DOMContentLoaded', () => {
    const mainCanvasFrame = document.querySelector('.main-canvas-frame');
    const touchPadsWrapper = document.querySelector('.touch-pads-wrapper');
    const deleteButton = document.getElementById('delete-selected-deco');
    const controlGroupWrapper = document.querySelector('.control-group-wrapper');

    let currentDecoList = []; // { id, x, y, rotation, scale }
    let selectedDecoIds = []; // ⭐ 다중 선택을 위해 배열로 변경

    // --- 1. 메인 창으로 메시지 전송 함수 ---
    function sendMessage(type, data = {}) {
        if (window.opener) {
            window.opener.postMessage({ type, ...data }, '*');
        }
    }

    // --- 2. 터치패드 동적 생성 및 업데이트 ---
    function updateTouchPads() {
        touchPadsWrapper.innerHTML = ''; 

        const frameWidth = mainCanvasFrame.offsetWidth;
        const frameHeight = mainCanvasFrame.offsetHeight;

        currentDecoList.forEach((deco, index) => {
            const pad = document.createElement('button');
            pad.classList.add('touch-pad');
            pad.id = `touch-pad-${deco.id}`;
            pad.dataset.id = deco.id;
            pad.title = `아이템 ${index + 1} 선택 및 이동`;

            const pixelX = deco.x * frameWidth;
            const pixelY = deco.y * frameHeight;

            pad.style.left = `${pixelX}px`;
            pad.style.top = `${pixelY}px`;
            pad.style.opacity = '1';

            // ⭐ 다중 선택 확인
            if (selectedDecoIds.includes(deco.id)) {
                pad.classList.add('selected');
            }

            // ⭐ 3. 클릭 (다중 선택) 이벤트 리스너
            pad.addEventListener('click', (e) => {
                e.stopPropagation();
                const decoId = deco.id;
                const isSelected = selectedDecoIds.includes(decoId);

                if (isSelected) {
                    // 이미 선택됨 -> 선택 해제
                    selectedDecoIds = selectedDecoIds.filter(id => id !== decoId);
                } else {
                    // 미선택 -> 선택 추가
                    if (selectedDecoIds.length < 2) {
                        selectedDecoIds.push(decoId);
                    } else {
                        // 2개 초과 (가장 오래된 것 제거 후 새 것 추가)
                        selectedDecoIds.shift(); 
                        selectedDecoIds.push(decoId);
                    }
                }
                
                // 메인 창에 배열 전송
                sendMessage('DECO_SELECT_MULTI', { ids: selectedDecoIds }); 
                updateTouchPads(); // UI 업데이트
            });

            // 드래그 이벤트 추가
            pad.addEventListener('mousedown', initDrag);
            pad.addEventListener('touchstart', initDrag, { passive: true });

            touchPadsWrapper.appendChild(pad);
        });

        // ⭐ 선택된 아이템이 1개 이상일 때 버튼 활성화
        const isSelected = selectedDecoIds.length > 0;
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.disabled = !isSelected;
        });
        deleteButton.disabled = !isSelected;
        controlGroupWrapper.classList.toggle('active', isSelected);
    }

    // --- 4. 터치패드 이동 (드래그) 구현 ---
    function initDrag(e) {
        const targetPad = e.currentTarget;
        const decoId = targetPad.dataset.id;

        // --- ⭐ 다중 선택 시 드래그 로직 수정 ---
        // 1. 드래그 시작한 패드가 선택 목록에 없으면, 이 패드만 선택
        if (!selectedDecoIds.includes(decoId)) {
            selectedDecoIds = [decoId];
            sendMessage('DECO_SELECT_MULTI', { ids: selectedDecoIds });
            updateTouchPads();
        }
        
        // 2. 선택된 아이템이 1개가 아니면 (0개 또는 2개) 드래그 비활성화
        if (selectedDecoIds.length !== 1) {
            return; 
        }
        // --- ⭐ 로직 수정 끝 ---

        e.preventDefault();

        const isTouch = e.type.startsWith('touch');
        let startX = isTouch ? e.touches[0].clientX : e.clientX;
        let startY = isTouch ? e.touches[0].clientY : e.clientY;

        let currentPadLeft = parseFloat(targetPad.style.left);
        let currentPadTop = parseFloat(targetPad.style.top);

        const frameRect = mainCanvasFrame.getBoundingClientRect();
        const frameWidth = frameRect.width;
        const frameHeight = frameRect.height;

        function drag(e_move) {
            const currentX = isTouch ? e_move.touches[0].clientX : e_move.clientX;
            const currentY = isTouch ? e_move.touches[0].clientY : e_move.clientY;

            const dx = currentX - startX;
            const dy = currentY - startY;

            let newPadLeft = currentPadLeft + dx;
            let newPadTop = currentPadTop + dy;

            const padHalf = targetPad.offsetWidth / 2;
            newPadLeft = Math.max(padHalf, Math.min(newPadLeft, frameWidth - padHalf));
            newPadTop = Math.max(padHalf, Math.min(newPadTop, frameHeight - padHalf));

            targetPad.style.left = `${newPadLeft}px`;
            targetPad.style.top = `${newPadTop}px`;
            
            const newNormX = newPadLeft / frameWidth;
            const newNormY = newPadTop / frameHeight;

            // ⭐ 1. 제자리 복귀 방지: 로컬 데이터 즉시 업데이트
            const deco = currentDecoList.find(d => d.id === decoId);
            if (deco) {
                deco.x = newNormX;
                deco.y = newNormY;
            }

            // 2. 메인 창으로 정규화된 좌표 전송
            sendMessage('DECO_CONTROL', {
                id: decoId,
                action: 'move',
                x: newNormX,
                y: newNormY
            });

            startX = currentX;
            startY = currentY;
            currentPadLeft = newPadLeft;
            currentPadTop = newPadTop;
        }

        function stopDrag() {
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchmove', drag);
            document.removeEventListener('touchend', stopDrag);
            // ⭐ 제자리로 리셋하는 코드를 넣지 않아 마지막 위치에 머무름
        }

        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', stopDrag);
    }

    // --- 5. 회전/크기/정렬 버튼 이벤트 리스너 ---
    document.querySelectorAll('.control-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // ⭐ 1개 이상 선택 시 작동
            if (selectedDecoIds.length === 0 || btn.disabled) return;

            const action = btn.dataset.action;
            const direction = btn.dataset.direction;

            // ⭐ 선택된 모든 ID에 대해 명령 전송
            sendMessage('DECO_CONTROL_MULTI', { 
                ids: selectedDecoIds, 
                action: action, 
                direction: direction 
            });
        });
    });

    // --- 6. 삭제 버튼 이벤트 리스너 ---
    deleteButton.addEventListener('click', () => {
        if (selectedDecoIds.length === 0 || deleteButton.disabled) return;
        
        // ⭐ 선택된 모든 ID 삭제 요청
        sendMessage('DECO_DELETE_MULTI', { ids: selectedDecoIds });
        selectedDecoIds = []; // 로컬 선택 목록 비우기
        updateTouchPads(); // UI 업데이트
    });


    // --- 7. 메인 창으로부터 메시지 수신 처리 ---
    window.addEventListener('message', (event) => {
        if (event.data.type === 'DECO_LIST_UPDATE') {
            currentDecoList = event.data.data;
            // ⭐ 메인 창에서 보낸 선택 목록(배열)으로 업데이트
            selectedDecoIds = event.data.selectedIds || []; 
            updateTouchPads();
        }
    });

    // --- 8. 초기 요청 ---
    window.onload = () => {
        // sendMessage('REQUEST_DECO_LIST');
        request_dummy_list(); // 테스트용 더미
    };

    function request_dummy_list() {
        console.log("더미 아이템 생성 중...");
        currentDecoList = [
            { id: 'item1', x: 0.25, y: 0.3, rotation: 0, scale: 1 },
            { id: 'item2', x: 0.5, y: 0.6, rotation: 0, scale: 1 },
            { id: 'item3', x: 0.75, y: 0.9, rotation: 0, scale: 1 }
        ];
        selectedDecoIds = ['item1']; // ⭐ 배열로 초기 선택
        updateTouchPads();
    }

    window.addEventListener('resize', () => {
        updateTouchPads();
    });
});
