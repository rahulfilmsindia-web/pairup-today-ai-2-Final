export interface CityOption {
  value: string;
  label: string;
  state: string;
}

export const PAN_INDIA_CITIES: CityOption[] = [
  // West Bengal
  { value: 'Kolkata', label: 'Kolkata', state: 'West Bengal' },
  { value: 'Howrah', label: 'Howrah', state: 'West Bengal' },
  { value: 'Durgapur', label: 'Durgapur', state: 'West Bengal' },
  { value: 'Asansol', label: 'Asansol', state: 'West Bengal' },
  { value: 'Siliguri', label: 'Siliguri', state: 'West Bengal' },
  { value: 'Bardhaman', label: 'Bardhaman / Burdwan', state: 'West Bengal' },
  { value: 'Kharagpur', label: 'Kharagpur', state: 'West Bengal' },
  { value: 'Malda', label: 'Malda', state: 'West Bengal' },
  { value: 'Haldia', label: 'Haldia', state: 'West Bengal' },
  { value: 'Baharampur', label: 'Baharampur', state: 'West Bengal' },
  { value: 'Baranagar', label: 'Baranagar', state: 'West Bengal' },
  { value: 'Habra', label: 'Habra', state: 'West Bengal' },
  { value: 'Bidhannagar', label: 'Bidhannagar / Salt Lake', state: 'West Bengal' },
  { value: 'Madhyamgram', label: 'Madhyamgram', state: 'West Bengal' },
  { value: 'Darjeeling', label: 'Darjeeling', state: 'West Bengal' },

  // Delhi NCR
  { value: 'Delhi', label: 'Delhi / New Delhi', state: 'Delhi NCR' },
  { value: 'Noida', label: 'Noida', state: 'Delhi NCR' },
  { value: 'Greater Noida', label: 'Greater Noida', state: 'Delhi NCR' },
  { value: 'Gurugram', label: 'Gurugram (Gurgaon)', state: 'Delhi NCR' },
  { value: 'Faridabad', label: 'Faridabad', state: 'Delhi NCR' },
  { value: 'Ghaziabad', label: 'Ghaziabad', state: 'Delhi NCR' },

  // Maharashtra
  { value: 'Mumbai', label: 'Mumbai', state: 'Maharashtra' },
  { value: 'Navi Mumbai', label: 'Navi Mumbai', state: 'Maharashtra' },
  { value: 'Thane', label: 'Thane', state: 'Maharashtra' },
  { value: 'Pune', label: 'Pune', state: 'Maharashtra' },
  { value: 'Nagpur', label: 'Nagpur', state: 'Maharashtra' },
  { value: 'Nashik', label: 'Nashik', state: 'Maharashtra' },
  { value: 'Aurangabad', label: 'Aurangabad (Chhatrapati Sambhaji Nagar)', state: 'Maharashtra' },
  { value: 'Solapur', label: 'Solapur', state: 'Maharashtra' },
  { value: 'Kolhapur', label: 'Kolhapur', state: 'Maharashtra' },
  { value: 'Amravati', label: 'Amravati', state: 'Maharashtra' },
  { value: 'Nanded', label: 'Nanded', state: 'Maharashtra' },
  { value: 'Sangli', label: 'Sangli', state: 'Maharashtra' },
  { value: 'Jalgaon', label: 'Jalgaon', state: 'Maharashtra' },
  { value: 'Akola', label: 'Akola', state: 'Maharashtra' },
  { value: 'Latur', label: 'Latur', state: 'Maharashtra' },
  { value: 'Dhule', label: 'Dhule', state: 'Maharashtra' },
  { value: 'Ahmednagar', label: 'Ahmednagar', state: 'Maharashtra' },

  // Karnataka
  { value: 'Bengaluru', label: 'Bengaluru (Bangalore)', state: 'Karnataka' },
  { value: 'Mysuru', label: 'Mysuru (Mysore)', state: 'Karnataka' },
  { value: 'Hubballi', label: 'Hubballi-Dharwad', state: 'Karnataka' },
  { value: 'Mangaluru', label: 'Mangaluru (Mangalore)', state: 'Karnataka' },
  { value: 'Belagavi', label: 'Belagavi (Belgaum)', state: 'Karnataka' },
  { value: 'Davanagere', label: 'Davanagere', state: 'Karnataka' },
  { value: 'Ballari', label: 'Ballari (Bellary)', state: 'Karnataka' },
  { value: 'Shivamogga', label: 'Shivamogga (Shimoga)', state: 'Karnataka' },
  { value: 'Tumakuru', label: 'Tumakuru (Tumkur)', state: 'Karnataka' },

  // Telangana
  { value: 'Hyderabad', label: 'Hyderabad', state: 'Telangana' },
  { value: 'Secunderabad', label: 'Secunderabad', state: 'Telangana' },
  { value: 'Warangal', label: 'Warangal', state: 'Telangana' },
  { value: 'Nizamabad', label: 'Nizamabad', state: 'Telangana' },
  { value: 'Karimnagar', label: 'Karimnagar', state: 'Telangana' },
  { value: 'Ramagundam', label: 'Ramagundam', state: 'Telangana' },
  { value: 'Khammam', label: 'Khammam', state: 'Telangana' },

  // Tamil Nadu
  { value: 'Chennai', label: 'Chennai', state: 'Tamil Nadu' },
  { value: 'Coimbatore', label: 'Coimbatore', state: 'Tamil Nadu' },
  { value: 'Madurai', label: 'Madurai', state: 'Tamil Nadu' },
  { value: 'Tiruchirappalli', label: 'Tiruchirappalli (Trichy)', state: 'Tamil Nadu' },
  { value: 'Salem', label: 'Salem', state: 'Tamil Nadu' },
  { value: 'Tirunelveli', label: 'Tirunelveli', state: 'Tamil Nadu' },
  { value: 'Tiruppur', label: 'Tiruppur', state: 'Tamil Nadu' },
  { value: 'Vellore', label: 'Vellore', state: 'Tamil Nadu' },
  { value: 'Erode', label: 'Erode', state: 'Tamil Nadu' },
  { value: 'Thoothukudi', label: 'Thoothukudi', state: 'Tamil Nadu' },

  // Gujarat
  { value: 'Ahmedabad', label: 'Ahmedabad', state: 'Gujarat' },
  { value: 'Surat', label: 'Surat', state: 'Gujarat' },
  { value: 'Vadodara', label: 'Vadodara (Baroda)', state: 'Gujarat' },
  { value: 'Rajkot', label: 'Rajkot', state: 'Gujarat' },
  { value: 'Bhavnagar', label: 'Bhavnagar', state: 'Gujarat' },
  { value: 'Jamnagar', label: 'Jamnagar', state: 'Gujarat' },
  { value: 'Junagadh', label: 'Junagadh', state: 'Gujarat' },
  { value: 'Gandhinagar', label: 'Gandhinagar', state: 'Gujarat' },
  { value: 'Anand', label: 'Anand', state: 'Gujarat' },

  // Rajasthan
  { value: 'Jaipur', label: 'Jaipur', state: 'Rajasthan' },
  { value: 'Jodhpur', label: 'Jodhpur', state: 'Rajasthan' },
  { value: 'Kota', label: 'Kota', state: 'Rajasthan' },
  { value: 'Bikaner', label: 'Bikaner', state: 'Rajasthan' },
  { value: 'Ajmer', label: 'Ajmer', state: 'Rajasthan' },
  { value: 'Udaipur', label: 'Udaipur', state: 'Rajasthan' },
  { value: 'Bhilwara', label: 'Bhilwara', state: 'Rajasthan' },
  { value: 'Alwar', label: 'Alwar', state: 'Rajasthan' },

  // Uttar Pradesh
  { value: 'Lucknow', label: 'Lucknow', state: 'Uttar Pradesh' },
  { value: 'Kanpur', label: 'Kanpur', state: 'Uttar Pradesh' },
  { value: 'Varanasi', label: 'Varanasi (Kashi)', state: 'Uttar Pradesh' },
  { value: 'Agra', label: 'Agra', state: 'Uttar Pradesh' },
  { value: 'Prayagraj', label: 'Prayagraj (Allahabad)', state: 'Uttar Pradesh' },
  { value: 'Bareilly', label: 'Bareilly', state: 'Uttar Pradesh' },
  { value: 'Aligarh', label: 'Aligarh', state: 'Uttar Pradesh' },
  { value: 'Moradabad', label: 'Moradabad', state: 'Uttar Pradesh' },
  { value: 'Saharanpur', label: 'Saharanpur', state: 'Uttar Pradesh' },
  { value: 'Gorakhpur', label: 'Gorakhpur', state: 'Uttar Pradesh' },
  { value: 'Jhansi', label: 'Jhansi', state: 'Uttar Pradesh' },
  { value: 'Meerut', label: 'Meerut', state: 'Uttar Pradesh' },
  { value: 'Mathura', label: 'Mathura', state: 'Uttar Pradesh' },
  { value: 'Ayodhya', label: 'Ayodhya', state: 'Uttar Pradesh' },

  // Bihar
  { value: 'Patna', label: 'Patna', state: 'Bihar' },
  { value: 'Gaya', label: 'Gaya', state: 'Bihar' },
  { value: 'Bhagalpur', label: 'Bhagalpur', state: 'Bihar' },
  { value: 'Muzaffarpur', label: 'Muzaffarpur', state: 'Bihar' },
  { value: 'Purnia', label: 'Purnia', state: 'Bihar' },
  { value: 'Darbhanga', label: 'Darbhanga', state: 'Bihar' },
  { value: 'Bihar Sharif', label: 'Bihar Sharif', state: 'Bihar' },

  // Madhya Pradesh
  { value: 'Bhopal', label: 'Bhopal', state: 'Madhya Pradesh' },
  { value: 'Indore', label: 'Indore', state: 'Madhya Pradesh' },
  { value: 'Jabalpur', label: 'Jabalpur', state: 'Madhya Pradesh' },
  { value: 'Gwalior', label: 'Gwalior', state: 'Madhya Pradesh' },
  { value: 'Ujjain', label: 'Ujjain', state: 'Madhya Pradesh' },
  { value: 'Sagar', label: 'Sagar', state: 'Madhya Pradesh' },

  // Punjab, Haryana & Chandigarh
  { value: 'Chandigarh', label: 'Chandigarh', state: 'Chandigarh' },
  { value: 'Amritsar', label: 'Amritsar', state: 'Punjab' },
  { value: 'Ludhiana', label: 'Ludhiana', state: 'Punjab' },
  { value: 'Jalandhar', label: 'Jalandhar', state: 'Punjab' },
  { value: 'Patiala', label: 'Patiala', state: 'Punjab' },
  { value: 'Panipat', label: 'Panipat', state: 'Haryana' },
  { value: 'Ambala', label: 'Ambala', state: 'Haryana' },
  { value: 'Karnal', label: 'Karnal', state: 'Haryana' },

  // Kerala
  { value: 'Kochi', label: 'Kochi (Cochin)', state: 'Kerala' },
  { value: 'Thiruvananthapuram', label: 'Thiruvananthapuram (Trivandrum)', state: 'Kerala' },
  { value: 'Kozhikode', label: 'Kozhikode (Calicut)', state: 'Kerala' },
  { value: 'Thrissur', label: 'Thrissur', state: 'Kerala' },
  { value: 'Kollam', label: 'Kollam', state: 'Kerala' },

  // Andhra Pradesh
  { value: 'Visakhapatnam', label: 'Visakhapatnam (Vizag)', state: 'Andhra Pradesh' },
  { value: 'Vijayawada', label: 'Vijayawada', state: 'Andhra Pradesh' },
  { value: 'Guntur', label: 'Guntur', state: 'Andhra Pradesh' },
  { value: 'Nellore', label: 'Nellore', state: 'Andhra Pradesh' },
  { value: 'Tirupati', label: 'Tirupati', state: 'Andhra Pradesh' },
  { value: 'Kakinada', label: 'Kakinada', state: 'Andhra Pradesh' },

  // Odisha
  { value: 'Bhubaneswar', label: 'Bhubaneswar', state: 'Odisha' },
  { value: 'Cuttack', label: 'Cuttack', state: 'Odisha' },
  { value: 'Rourkela', label: 'Rourkela', state: 'Odisha' },
  { value: 'Puri', label: 'Puri', state: 'Odisha' },

  // Chhattisgarh & Jharkhand
  { value: 'Raipur', label: 'Raipur', state: 'Chhattisgarh' },
  { value: 'Bhilai', label: 'Bhilai', state: 'Chhattisgarh' },
  { value: 'Bilaspur', label: 'Bilaspur', state: 'Chhattisgarh' },
  { value: 'Ranchi', label: 'Ranchi', state: 'Jharkhand' },
  { value: 'Jamshedpur', label: 'Jamshedpur', state: 'Jharkhand' },
  { value: 'Dhanbad', label: 'Dhanbad', state: 'Jharkhand' },
  { value: 'Bokaro', label: 'Bokaro Steel City', state: 'Jharkhand' },

  // Assam & North East
  { value: 'Guwahati', label: 'Guwahati', state: 'Assam' },
  { value: 'Silchar', label: 'Silchar', state: 'Assam' },
  { value: 'Dibrugarh', label: 'Dibrugarh', state: 'Assam' },
  { value: 'Agartala', label: 'Agartala', state: 'Tripura' },
  { value: 'Shillong', label: 'Shillong', state: 'Meghalaya' },
  { value: 'Imphal', label: 'Imphal', state: 'Manipur' },
  { value: 'Aizawl', label: 'Aizawl', state: 'Mizoram' },
  { value: 'Gangtok', label: 'Gangtok', state: 'Sikkim' },

  // Uttarakhand & Himachal
  { value: 'Dehradun', label: 'Dehradun', state: 'Uttarakhand' },
  { value: 'Haridwar', label: 'Haridwar', state: 'Uttarakhand' },
  { value: 'Rishikesh', label: 'Rishikesh', state: 'Uttarakhand' },
  { value: 'Shimla', label: 'Shimla', state: 'Himachal Pradesh' },
  { value: 'Dharamshala', label: 'Dharamshala', state: 'Himachal Pradesh' },

  // Jammu & Kashmir
  { value: 'Srinagar', label: 'Srinagar', state: 'Jammu & Kashmir' },
  { value: 'Jammu', label: 'Jammu', state: 'Jammu & Kashmir' },

  // Goa & UTs
  { value: 'Goa', label: 'Goa (Panaji / Margao)', state: 'Goa' },
  { value: 'Puducherry', label: 'Puducherry (Pondicherry)', state: 'Puducherry' }
];
