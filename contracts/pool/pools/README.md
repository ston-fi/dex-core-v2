# Adding pools
 
A pool must implement: 
```func
;; state_init
(cell) pool_idata(slice _router_address, slice _first_jetton_address, slice _second_jetton_address, cell _jetton_lp_wallet_code, cell _lp_account_code);

;; pool
(int, int, int) pool::get_swap_out(int _side, int _ref_value, int _amount_in, int _reserve_in, int _reserve_out);
(int, int, int) pool::get_lp_provide_out(int _left_amount, int _right_amount);
(int)           pool::get_lp_provide_init_out(int _left_amount, int _right_amount);
(int, int)      pool::get_lp_burn_out(int _lp_amount);

;; storage functions
() storage::save();
() storage::load();

;; offchain get methods
_ get_pool_data();
```