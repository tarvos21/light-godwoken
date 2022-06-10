import React, { useState } from "react";
import styled from "styled-components";
import { notification } from "antd";
import { Cell, utils } from "@ckb-lumos/lumos";
import { useLightGodwoken } from "../../hooks/useLightGodwoken";
import { isInstanceOfLightGodwokenV0 } from "../../utils/typeAssert";
import { Actions, ConfirmModal, LoadingWrapper, PlainButton, SecondeButton, Text, Tips } from "../../style/common";
import { LoadingOutlined } from "@ant-design/icons";
import { NotEnoughCapacityError } from "../../light-godwoken/constants/error";
import { captureException } from "@sentry/react";
import { useGodwokenVersion } from "../../hooks/useGodwokenVersion";
import { useL1TxHistory } from "../../hooks/useL1TxHistory";
import { Token } from "../../light-godwoken/lightGodwokenType";

const ModalContent = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  .title {
    font-size: 14px;
    padding-bottom: 16px;
    font-weight: bold;
  }
`;
export interface Props {
  cell: Cell;
}
const Unlock = ({ cell }: Props) => {
  const lightGodwoken = useLightGodwoken();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const godwokenVersion = useGodwokenVersion();
  const l1Address = lightGodwoken?.provider.getL1Address();
  const { addTxToHistory } = useL1TxHistory(`${godwokenVersion}/${l1Address}/withdrawal`);
  const tokenMap = lightGodwoken?.getBuiltinSUDTMapByTypeHash() || {};

  let token: Token, amount: string;
  if (cell.cell_output.type) {
    token = tokenMap[utils.computeScriptHash(cell.cell_output.type)];
    amount = utils.readBigUInt128LECompatible(cell.data).toHexString();
  }
  if (lightGodwoken?.getVersion().toString() !== "v0") {
    return <></>;
  }
  const unlock = async () => {
    if (isInstanceOfLightGodwokenV0(lightGodwoken)) {
      setIsUnlocking(true);
      try {
        const txHash = await lightGodwoken.unlock({ cell });
        const linkToExplorer = () => {
          window.open(`${lightGodwoken.getConfig().layer1Config.SCANNER_URL}/transaction/${txHash}`, "_blank");
        };
        notification.success({ message: `Unlock Tx(${txHash}) is successful`, onClick: linkToExplorer });
        addTxToHistory({
          type: "withdrawal",
          txHash,
          capacity: cell.cell_output.capacity,
          amount: amount,
          token: token,
          status: "success",
        });
      } catch (e) {
        console.error(e);
        if (e instanceof NotEnoughCapacityError) {
          notification.error({ message: `Unlock Transaction fail, you need to get some ckb on L1 first` });
          return;
        }
        if (e instanceof Error) {
          notification.error({ message: `Unknown error, please try again later` });
        }
        captureException(e);
      } finally {
        setIsUnlocking(false);
        setIsModalVisible(false);
      }
    }
  };

  const showCurrencySelectModal = () => {
    setIsModalVisible(true);
  };

  const handleOk = () => {
    setIsModalVisible(false);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  return (
    <div>
      <SecondeButton className="withdraw-button" onClick={showCurrencySelectModal}>
        unlock
      </SecondeButton>
      <ConfirmModal
        title="Unlock Withdrawal"
        visible={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        footer={null}
        width={400}
      >
        <ModalContent>
          <Text className="title">Unlock withdraw to below address</Text>
          <Text>{lightGodwoken?.provider.getL1Address()}</Text>
          {isUnlocking && (
            <LoadingWrapper>
              <LoadingOutlined />
            </LoadingWrapper>
          )}
          {isUnlocking && <Tips>Waiting for User Confirmation</Tips>}

          <Actions>
            <PlainButton className="cancel" onClick={handleCancel}>
              Cancel
            </PlainButton>
            <SecondeButton className="confirm" onClick={unlock} disabled={isUnlocking}>
              Confirm
            </SecondeButton>
          </Actions>
        </ModalContent>
      </ConfirmModal>
    </div>
  );
};

export default Unlock;
